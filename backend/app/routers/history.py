from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas
from app.tz import today_bogota

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[schemas.HistorialEntryOut])
def list_history(
    date_filter: Optional[str] = None,
    date_from:   Optional[str] = None,
    date_to:     Optional[str] = None,
    search:      Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List service orders.
    - date_filter: YYYY-MM-DD (default = today, used for single-day view)
    - date_from + date_to: YYYY-MM-DD range (used for PDF export)
    - search: filters by plate, client name, or order number
    """
    q = (
        db.query(models.ServiceOrder)
        .join(models.Vehicle)
        .join(models.Client, models.Vehicle.client_id == models.Client.id, isouter=True)
        .options(
            joinedload(models.ServiceOrder.vehicle).joinedload(models.Vehicle.client),
            joinedload(models.ServiceOrder.items),
            joinedload(models.ServiceOrder.operator),
        )
    )

    if date_from and date_to:
        try:
            d_from = date.fromisoformat(date_from)
            d_to   = date.fromisoformat(date_to)
            q = q.filter(models.ServiceOrder.date >= d_from, models.ServiceOrder.date <= d_to)
        except ValueError:
            pass
    else:
        try:
            target_date = date.fromisoformat(date_filter) if date_filter else today_bogota()
        except ValueError:
            target_date = today_bogota()
        q = q.filter(models.ServiceOrder.date == target_date)

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
