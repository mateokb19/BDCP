from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[schemas.HistorialEntryOut])
def list_history(
    date_filter: Optional[str] = None,
    search:      Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List service orders.
    - date_filter: YYYY-MM-DD (default = today)
    - search: filters by plate, client name, or order number
    """
    try:
        target_date = date.fromisoformat(date_filter) if date_filter else date.today()
    except ValueError:
        target_date = date.today()

    q = (
        db.query(models.ServiceOrder)
        .join(models.Vehicle)
        .join(models.Client, models.Vehicle.client_id == models.Client.id, isouter=True)
        .options(
            joinedload(models.ServiceOrder.vehicle).joinedload(models.Vehicle.client),
            joinedload(models.ServiceOrder.items),
            joinedload(models.ServiceOrder.operator),
        )
        .filter(models.ServiceOrder.date == target_date)
    )

    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.Vehicle.plate.ilike(s),
                models.Client.name.ilike(s),
                models.ServiceOrder.order_number.ilike(s),
            )
        )

    return q.order_by(models.ServiceOrder.created_at.desc()).all()
