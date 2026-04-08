import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=schemas.HistorialPageOut)
def list_history(
    date_filter: Optional[str] = None,
    date_from:   Optional[str] = None,
    date_to:     Optional[str] = None,
    month:       Optional[str] = None,
    search:      Optional[str] = None,
    offset:      int           = 0,
    limit:       int           = 30,
    sort:        str           = "desc",
    db: Session = Depends(get_db),
):
    """
    List service orders (paginated).
    - date_filter: YYYY-MM-DD — single day filter
    - date_from + date_to: YYYY-MM-DD range — for PDF export (use limit=1000)
    - month: YYYY-MM — filter by month
    - No date params → returns all orders
    - sort: 'desc' (newest first, default) | 'asc' (oldest first)
    - offset/limit: pagination
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
    elif date_filter:
        try:
            target_date = date.fromisoformat(date_filter)
            q = q.filter(models.ServiceOrder.date == target_date)
        except ValueError:
            pass
    elif month:
        try:
            y, m = (int(x) for x in month.split("-"))
            d_from = date(y, m, 1)
            d_to   = date(y, m, calendar.monthrange(y, m)[1])
            q = q.filter(models.ServiceOrder.date >= d_from, models.ServiceOrder.date <= d_to)
        except (ValueError, AttributeError):
            pass
    # else: no date filter → all orders

    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.Vehicle.plate.ilike(s),
                models.Client.name.ilike(s),
                models.ServiceOrder.order_number.ilike(s),
            )
        )

    order_col = models.ServiceOrder.created_at
    q = q.order_by(order_col.asc() if sort == "asc" else order_col.desc())

    total = q.count()
    items = q.offset(offset).limit(limit).all()

    return {"items": items, "total": total}
