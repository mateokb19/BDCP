from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, contains_eager

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

    # Income is counted on the DELIVERY date (when payment is received), not the order creation date.
    # Use patio.delivered_at; fall back to order.date if no patio entry.
    _eff_date = func.coalesce(
        func.date(models.PatioEntry.delivered_at),
        models.ServiceOrder.date,
    )
    delivered_orders = (
        db.query(models.ServiceOrder)
        .outerjoin(models.PatioEntry, models.PatioEntry.order_id == models.ServiceOrder.id)
        .options(contains_eager(models.ServiceOrder.patio_entry))
        .filter(
            models.ServiceOrder.status == models.OrderStatusEnum.entregado,
            _eff_date >= date_start,
            _eff_date <= date_end,
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
        if o.patio_entry and o.patio_entry.delivered_at:
            key = str(o.patio_entry.delivered_at.date())
        else:
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


# Maps frontend method key → (payment column attr, downpayment_method label)
_METHOD_MAP = {
    "cash":        ("payment_cash",        "Efectivo"),
    "datafono":    ("payment_datafono",    "Banco Caja Social"),
    "nequi":       ("payment_nequi",       "Nequi"),
    "bancolombia": ("payment_bancolombia", "Bancolombia"),
}


@router.get("/breakdown", response_model=List[schemas.IngresoBreakdownItem])
def get_breakdown(
    method: str,
    date_start: str,
    date_end: str,
    db: Session = Depends(get_db),
):
    if method not in _METHOD_MAP:
        raise HTTPException(status_code=422, detail=f"Método inválido: {method}")

    try:
        ds = date.fromisoformat(date_start)
        de = date.fromisoformat(date_end)
    except ValueError:
        raise HTTPException(status_code=422, detail="Fechas inválidas")

    col_attr, abono_label = _METHOD_MAP[method]

    _eff_date_bd = func.coalesce(
        func.date(models.PatioEntry.delivered_at),
        models.ServiceOrder.date,
    )

    def _load_delivered(base_q):
        return (
            base_q
            .outerjoin(models.PatioEntry, models.PatioEntry.order_id == models.ServiceOrder.id)
            .options(
                contains_eager(models.ServiceOrder.patio_entry),
                joinedload(models.ServiceOrder.vehicle).joinedload(models.Vehicle.client),
            )
            .filter(
                _eff_date_bd >= ds,
                _eff_date_bd <= de,
            )
            .all()
        )

    def _load_abono(base_q):
        return (
            base_q
            .options(
                joinedload(models.ServiceOrder.vehicle).joinedload(models.Vehicle.client)
            )
            .filter(
                models.ServiceOrder.date >= ds,
                models.ServiceOrder.date <= de,
            )
            .all()
        )

    def _item(o, amount, is_abono=False):
        v = o.vehicle
        brand_model = f"{v.brand or ''} {v.model or ''}".strip() if v else "—"
        client_name = (v.client.name if v and v.client else None) or "—"
        if not is_abono and o.patio_entry and o.patio_entry.delivered_at:
            item_date = str(o.patio_entry.delivered_at.date())
        else:
            item_date = str(o.date)
        return schemas.IngresoBreakdownItem(
            order_number=o.order_number or f"#{o.id}",
            date=item_date,
            plate=v.plate if v else "—",
            vehicle=brand_model,
            client=client_name,
            amount=float(amount),
            is_abono=is_abono,
        )

    results: list[schemas.IngresoBreakdownItem] = []

    # Final payments (delivered orders) — filtered by delivery date
    delivered = _load_delivered(
        db.query(models.ServiceOrder).filter(
            models.ServiceOrder.status == models.OrderStatusEnum.entregado,
            getattr(models.ServiceOrder, col_attr) > 0,
        )
    )
    for o in delivered:
        results.append(_item(o, getattr(o, col_attr)))

    # Abono payments (filtered by order creation date — abono is received when order is created)
    abono_orders = _load_abono(
        db.query(models.ServiceOrder).filter(
            models.ServiceOrder.status != models.OrderStatusEnum.cancelado,
            models.ServiceOrder.downpayment > 0,
            models.ServiceOrder.downpayment_method == abono_label,
        )
    )
    for o in abono_orders:
        results.append(_item(o, o.downpayment, is_abono=True))

    results.sort(key=lambda x: x.date, reverse=True)
    return results
