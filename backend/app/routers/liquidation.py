import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.database import get_db
from app.tz import today_bogota

router = APIRouter(prefix="/liquidation", tags=["liquidation"])

QUALIFYING_STATUSES = {"en_proceso", "listo", "entregado"}
DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]


def _build_week_response(
    operator: models.Operator,
    ws: date,
    we: date,
    qualifying: list,
    liq_record: models.WeekLiquidation | None,
) -> schemas.LiqWeekResponse:
    days_map: dict[date, list] = {}
    for i in range(7):
        days_map[ws + timedelta(days=i)] = []

    for order in qualifying:
        d = order.date if isinstance(order.date, date) else date.fromisoformat(str(order.date))
        if d in days_map:
            days_map[d].append(order)

    rate = Decimal(str(operator.commission_rate)) / Decimal("100")

    days = []
    for d in sorted(days_map.keys()):
        day_orders = days_map[d]
        day_idx = d.isoweekday() % 7
        day_total = sum((o.total or Decimal("0")) for o in day_orders)
        days.append(schemas.LiqWeekDay(
            date=str(d),
            day_name=DAY_NAMES[day_idx],
            orders=[
                schemas.LiqWeekOrder(
                    order_id=o.id,
                    order_number=o.order_number,
                    patio_status=o.patio_entry.status,
                    vehicle_plate=o.vehicle.plate,
                    vehicle_brand=o.vehicle.brand,
                    vehicle_model=o.vehicle.model,
                    items=[
                        schemas.LiqWeekOrderItem(
                            service_name=i.service_name,
                            unit_price=i.unit_price,
                            quantity=i.quantity,
                            subtotal=i.subtotal,
                        )
                        for i in o.items
                    ],
                    total=o.total or Decimal("0"),
                    is_liquidated=o.week_liquidation_id is not None,
                )
                for o in day_orders
            ],
            day_total=day_total,
            day_services=len(day_orders),
        ))

    week_total = sum((o.total or Decimal("0")) for o in qualifying)
    commission = (rate * week_total).quantize(Decimal("0.01"))
    unliquidated_count = sum(1 for o in qualifying if o.week_liquidation_id is None)

    return schemas.LiqWeekResponse(
        operator_id=operator.id,
        operator_name=operator.name,
        commission_rate=operator.commission_rate,
        week_start=str(ws),
        week_end=str(we),
        days=days,
        week_total=week_total,
        week_services=len(qualifying),
        commission_amount=commission,
        is_liquidated=liq_record is not None,
        unliquidated_count=unliquidated_count,
        liquidated_at=str(liq_record.liquidated_at) if liq_record else None,
        net_amount=liq_record.net_amount if liq_record else None,
        payment_transfer_amount=liq_record.payment_transfer if liq_record else None,
        payment_cash_amount=liq_record.payment_cash if liq_record else None,
        amount_pending=liq_record.amount_pending if liq_record else None,
    )


def _fetch_qualifying(op_id: int, ws: date, we: date, db: Session) -> list:
    orders = (
        db.query(models.ServiceOrder)
        .options(
            joinedload(models.ServiceOrder.items),
            joinedload(models.ServiceOrder.vehicle),
            joinedload(models.ServiceOrder.patio_entry),
        )
        .filter(
            models.ServiceOrder.operator_id == op_id,
            models.ServiceOrder.date >= ws,
            models.ServiceOrder.date <= we,
        )
        .all()
    )
    return [o for o in orders if o.patio_entry and o.patio_entry.status in QUALIFYING_STATUSES]


@router.get("/{op_id}/week", response_model=schemas.LiqWeekResponse)
def get_week(op_id: int, week_start: str = Query(...), db: Session = Depends(get_db)):
    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")

    ws = date.fromisoformat(week_start)
    we = ws + timedelta(days=6)
    qualifying = _fetch_qualifying(op_id, ws, we, db)
    liq = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()

    return _build_week_response(operator, ws, we, qualifying, liq)


@router.post("/{op_id}/liquidate", response_model=schemas.LiqWeekResponse)
def liquidate_week(
    op_id: int,
    week_start: str = Query(...),
    body: schemas.LiquidatePayload = schemas.LiquidatePayload(),
    db: Session = Depends(get_db),
):
    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")

    ws = date.fromisoformat(week_start)
    we = ws + timedelta(days=6)

    qualifying = _fetch_qualifying(op_id, ws, we, db)
    # Only process orders that haven't been liquidated yet
    unliquidated = [o for o in qualifying if o.week_liquidation_id is None]

    existing = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()

    if not unliquidated:
        return _build_week_response(operator, ws, we, qualifying, existing)

    rate = Decimal(str(operator.commission_rate)) / Decimal("100")
    new_gross = sum((o.total or Decimal("0")) for o in unliquidated)
    new_commission = (rate * new_gross).quantize(Decimal("0.01"))

    # Process operator→company abonos
    total_abonos = Decimal("0")
    for abono in body.abonos:
        if abono.amount <= 0:
            continue
        debt = db.query(models.Debt).filter_by(id=abono.debt_id, operator_id=op_id).first()
        if not debt or debt.direction != "operario_empresa":
            continue
        remaining = debt.amount - (debt.paid_amount or Decimal("0"))
        pay = min(abono.amount, remaining)
        payment = models.DebtPayment(debt_id=debt.id, amount=pay)
        db.add(payment)
        debt.paid_amount = (debt.paid_amount or Decimal("0")) + pay
        if debt.paid_amount >= debt.amount:
            debt.paid = True
        total_abonos += pay

    # Process empresa→operario settlements
    total_settled = Decimal("0")
    for settlement in body.company_settlements:
        if settlement.amount <= 0:
            continue
        debt = db.query(models.Debt).filter_by(id=settlement.debt_id, operator_id=op_id).first()
        if not debt or debt.direction != "empresa_operario":
            continue
        remaining = debt.amount - (debt.paid_amount or Decimal("0"))
        pay = min(settlement.amount, remaining)
        payment = models.DebtPayment(debt_id=debt.id, amount=pay)
        db.add(payment)
        debt.paid_amount = (debt.paid_amount or Decimal("0")) + pay
        if debt.paid_amount >= debt.amount:
            debt.paid = True
        total_settled += pay

    db.flush()

    net_amount = (new_commission - total_abonos + total_settled).quantize(Decimal("0.01"))
    total_paid = (body.payment_transfer + body.payment_cash).quantize(Decimal("0.01"))
    amount_pending = max(Decimal("0"), net_amount - total_paid).quantize(Decimal("0.01"))

    if existing:
        # Update the existing liquidation record with the incremental amounts
        existing.total_amount      = (existing.total_amount      or Decimal("0")) + new_gross
        existing.commission_amount = (existing.commission_amount or Decimal("0")) + new_commission
        existing.net_amount        = (existing.net_amount        or Decimal("0")) + net_amount
        existing.payment_transfer  = (existing.payment_transfer  or Decimal("0")) + body.payment_transfer
        existing.payment_cash      = (existing.payment_cash      or Decimal("0")) + body.payment_cash
        existing.amount_pending    = (existing.amount_pending    or Decimal("0")) + amount_pending
        liq = existing
    else:
        liq = models.WeekLiquidation(
            operator_id=op_id,
            week_start=ws,
            total_amount=new_gross,
            commission_amount=new_commission,
            net_amount=net_amount,
            payment_transfer=body.payment_transfer,
            payment_cash=body.payment_cash,
            amount_pending=amount_pending,
        )
        db.add(liq)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            existing = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()
            return _build_week_response(operator, ws, we, qualifying, existing)

    # Stamp unliquidated orders with this liquidation's id
    for o in unliquidated:
        o.week_liquidation_id = liq.id

    # Auto-create empresa→operario debt for any pending amount
    if amount_pending > 0:
        pending_debt = models.Debt(
            operator_id=op_id,
            direction="empresa_operario",
            amount=amount_pending,
            description=f"Pendiente liquidación semana {week_start}",
        )
        db.add(pending_debt)

    db.commit()
    db.refresh(liq)

    # Link debt payments to this liquidation
    all_debt_ids = [a.debt_id for a in body.abonos] + [s.debt_id for s in body.company_settlements]
    if all_debt_ids:
        db.query(models.DebtPayment).filter(
            models.DebtPayment.liquidation_id.is_(None),
            models.DebtPayment.debt_id.in_(all_debt_ids),
        ).update({"liquidation_id": liq.id}, synchronize_session=False)
        db.commit()

    qualifying = _fetch_qualifying(op_id, ws, we, db)
    return _build_week_response(operator, ws, we, qualifying, liq)


@router.get("/{op_id}/debts", response_model=list[schemas.DebtOut])
def list_debts(op_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Debt)
        .options(joinedload(models.Debt.payments))
        .filter_by(operator_id=op_id)
        .order_by(models.Debt.created_at.desc())
        .all()
    )


@router.post("/{op_id}/debts", response_model=schemas.DebtOut)
def create_debt(op_id: int, body: schemas.DebtCreate, db: Session = Depends(get_db)):
    debt = models.Debt(operator_id=op_id, **body.model_dump())
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return debt


@router.get("/{op_id}/report", response_model=schemas.ReportResponse)
def get_report(
    op_id: int,
    period: str = Query("week"),
    ref_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")

    real_today = today_bogota()
    ref = date.fromisoformat(ref_date) if ref_date else real_today

    MONTH_NAMES = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ]

    if period == "month":
        ds = ref.replace(day=1)
        is_current_month = (ref.year == real_today.year and ref.month == real_today.month)
        if is_current_month:
            de = real_today
            period_label = f"Mes actual ({MONTH_NAMES[ref.month]} {ref.year})"
        else:
            last_day = calendar.monthrange(ref.year, ref.month)[1]
            de = ref.replace(day=last_day)
            period_label = f"{MONTH_NAMES[ref.month]} {ref.year}"
    else:
        # Sunday of the week containing ref  (isoweekday: Mon=1…Sun=7; Sun%7=0)
        ds = ref - timedelta(days=ref.isoweekday() % 7)
        de = min(ds + timedelta(days=6), real_today)
        period_label = f"Semana del {ds.strftime('%d/%m')} al {de.strftime('%d/%m/%Y')}"

    qualifying = _fetch_qualifying(op_id, ds, de, db)
    rate = Decimal(str(operator.commission_rate)) / Decimal("100")
    gross_total = sum((o.total or Decimal("0")) for o in qualifying)
    commission = (rate * gross_total).quantize(Decimal("0.01"))

    orders = [
        schemas.ReportOrder(
            order_number=o.order_number,
            date=str(o.date),
            vehicle_plate=o.vehicle.plate,
            vehicle_brand=o.vehicle.brand,
            vehicle_model=o.vehicle.model,
            items=[
                schemas.ReportOrderItem(
                    service_name=i.service_name,
                    service_category=i.service_category,
                    unit_price=i.unit_price,
                    quantity=i.quantity,
                    subtotal=i.subtotal,
                )
                for i in o.items
            ],
            total=o.total or Decimal("0"),
            is_liquidated=o.week_liquidation_id is not None,
        )
        for o in sorted(qualifying, key=lambda x: x.date)
    ]

    # ── Per-week liquidation status (Sunday-based weeks) ──────────────────────
    # Find the first Sunday on or before ds
    first_sunday = ds - timedelta(days=ds.isoweekday() % 7)
    week_statuses: list[schemas.ReportWeekStatus] = []
    cur = first_sunday
    while cur <= de:
        ws_end = cur + timedelta(days=6)
        liq = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=cur).first()
        week_orders = [o for o in qualifying if cur <= o.date <= ws_end]
        wk_gross = sum((o.total or Decimal("0")) for o in week_orders)
        wk_comm  = (rate * wk_gross).quantize(Decimal("0.01"))
        # Week is fully liquidated only when ALL its orders are stamped
        all_liquidated = len(week_orders) > 0 and all(o.week_liquidation_id is not None for o in week_orders)
        week_statuses.append(schemas.ReportWeekStatus(
            week_start=str(cur),
            week_end=str(ws_end),
            is_liquidated=all_liquidated,
            week_gross=wk_gross,
            week_commission=wk_comm,
            net_amount=liq.net_amount if liq else None,
            payment_transfer=liq.payment_transfer if liq else None,
            payment_cash=liq.payment_cash if liq else None,
            amount_pending=liq.amount_pending if liq else None,
        ))
        cur += timedelta(days=7)

    # ── Pending debts owed by the company to the operator ─────────────────────
    raw_debts = (
        db.query(models.Debt)
        .filter_by(operator_id=op_id, direction="empresa_operario", paid=False)
        .order_by(models.Debt.created_at)
        .all()
    )
    pending_debts = [
        schemas.ReportPendingDebt(
            description=d.description,
            amount=d.amount,
            paid_amount=d.paid_amount or Decimal("0"),
            remaining=d.amount - (d.paid_amount or Decimal("0")),
        )
        for d in raw_debts
        if d.amount - (d.paid_amount or Decimal("0")) > 0
    ]
    total_pending_owed = sum(pd.remaining for pd in pending_debts)

    return schemas.ReportResponse(
        operator_id=operator.id,
        operator_name=operator.name,
        commission_rate=operator.commission_rate,
        period_label=period_label,
        date_start=str(ds),
        date_end=str(de),
        orders=orders,
        total_services=len(qualifying),
        gross_total=gross_total,
        commission_amount=commission,
        week_statuses=week_statuses,
        pending_debts=pending_debts,
        total_pending_owed=total_pending_owed,
    )


@router.patch("/debts/{debt_id}/paid", response_model=schemas.DebtOut)
def mark_debt_paid(debt_id: int, db: Session = Depends(get_db)):
    debt = db.query(models.Debt).options(joinedload(models.Debt.payments)).filter_by(id=debt_id).first()
    if not debt:
        raise HTTPException(404, "Deuda no encontrada")
    debt.paid = True
    debt.paid_amount = debt.amount
    db.commit()
    db.refresh(debt)
    return debt
