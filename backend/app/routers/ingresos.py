from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.tz import today_bogota

router = APIRouter(prefix="/ingresos", tags=["ingresos"])


@router.get("", response_model=schemas.IngresosResponse)
def get_ingresos(
    period: str = "month",
    ref_date: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Aggregate income from delivered service orders.
    period: day | week | month | year
    ref_date: YYYY-MM-DD reference date (defaults to today in Bogotá TZ)
    """
    today = today_bogota()
    if ref_date:
        try:
            today = date.fromisoformat(ref_date)
        except ValueError:
            pass

    if period == "day":
        date_start = today
        date_end   = today
    elif period == "week":
        # Week starts Sunday
        days_since_sunday = (today.weekday() + 1) % 7
        date_start = today - timedelta(days=days_since_sunday)
        date_end   = date_start + timedelta(days=6)
    elif period == "year":
        date_start = date(today.year, 1, 1)
        date_end   = date(today.year, 12, 31)
    else:  # month (default)
        date_start = date(today.year, today.month, 1)
        date_end   = date(today.year, today.month, monthrange(today.year, today.month)[1])

    delivered_orders = (
        db.query(models.ServiceOrder)
        .filter(
            models.ServiceOrder.status == models.OrderStatusEnum.entregado,
            models.ServiceOrder.date >= date_start,
            models.ServiceOrder.date <= date_end,
        )
        .all()
    )

    # Non-cancelled orders with a downpayment (abono received at order creation)
    abono_orders = (
        db.query(models.ServiceOrder)
        .filter(
            models.ServiceOrder.status != models.OrderStatusEnum.cancelado,
            models.ServiceOrder.downpayment > 0,
            models.ServiceOrder.date >= date_start,
            models.ServiceOrder.date <= date_end,
        )
        .all()
    )

    def _abono_bucket(method: str | None) -> str:
        if method == "Nequi":             return "payment_nequi"
        if method == "Bancolombia":       return "payment_bancolombia"
        if method == "Banco Caja Social": return "payment_datafono"
        return "payment_cash"   # Efectivo or unspecified → cash bucket

    payment_cash        = sum(float(o.payment_cash)        for o in delivered_orders)
    payment_datafono    = sum(float(o.payment_datafono)    for o in delivered_orders)
    payment_nequi       = sum(float(o.payment_nequi)       for o in delivered_orders)
    payment_bancolombia = sum(float(o.payment_bancolombia) for o in delivered_orders)

    # Add abonos to per-method buckets
    for o in abono_orders:
        amt = float(o.downpayment)
        bucket = _abono_bucket(o.downpayment_method)
        if bucket == "payment_cash":        payment_cash        += amt
        elif bucket == "payment_datafono":  payment_datafono    += amt
        elif bucket == "payment_nequi":     payment_nequi       += amt
        else:                               payment_bancolombia += amt

    total = payment_cash + payment_datafono + payment_nequi + payment_bancolombia

    # Build daily map
    daily: dict[str, dict] = defaultdict(lambda: {
        "total": 0.0, "payment_cash": 0.0,
        "payment_datafono": 0.0, "payment_nequi": 0.0, "payment_bancolombia": 0.0,
    })
    for o in delivered_orders:
        key = str(o.date)
        daily[key]["payment_cash"]        += float(o.payment_cash)
        daily[key]["payment_datafono"]    += float(o.payment_datafono)
        daily[key]["payment_nequi"]       += float(o.payment_nequi)
        daily[key]["payment_bancolombia"] += float(o.payment_bancolombia)

    for o in abono_orders:
        key = str(o.date)
        amt = float(o.downpayment)
        bucket = _abono_bucket(o.downpayment_method)
        daily[key][bucket] += amt

    for key in daily:
        d = daily[key]
        d["total"] = d["payment_cash"] + d["payment_datafono"] + d["payment_nequi"] + d["payment_bancolombia"]

    # Generate full date range (no gaps)
    daily_totals = []
    cur = date_start
    while cur <= date_end:
        key = str(cur)
        d = daily[key]
        daily_totals.append(schemas.IngresosDayTotal(
            date=key,
            total=d["total"],
            payment_cash=d["payment_cash"],
            payment_datafono=d["payment_datafono"],
            payment_nequi=d["payment_nequi"],
            payment_bancolombia=d["payment_bancolombia"],
        ))
        cur += timedelta(days=1)

    return schemas.IngresosResponse(
        date_start=str(date_start),
        date_end=str(date_end),
        total=total,
        order_count=len(delivered_orders),
        payment_cash=payment_cash,
        payment_datafono=payment_datafono,
        payment_nequi=payment_nequi,
        payment_bancolombia=payment_bancolombia,
        daily_totals=daily_totals,
    )
