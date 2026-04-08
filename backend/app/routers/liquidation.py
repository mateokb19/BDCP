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

DETALLADO_CATEGORIES = {"exterior", "interior", "ceramico", "correccion_pintura"}
PINTURA_PIECE_RATE   = Decimal("90000")

CATEGORY_MAP: dict[str, set[str]] = {
    "detallado":  DETALLADO_CATEGORIES,
    "pintura":    {"pintura"},
    "latoneria":  {"latoneria"},
    "ppf":        {"ppf"},
    "polarizado": {"polarizado"},
}

CERAMIC_BONUSES: dict[str, Decimal] = {
    "Superior Shine +2":           Decimal("60000"),
    "Superior Shine +5":           Decimal("80000"),
    "Superior Shine +9":           Decimal("80000"),
    "Superior Shine +9 EXCLUSIVE": Decimal("80000"),
}


def _signature_price(svc, vehicle_type) -> Decimal:
    """Return the Signature correction service price for a given vehicle type."""
    if svc is None:
        return Decimal("0")
    vt = vehicle_type.value if hasattr(vehicle_type, "value") else str(vehicle_type)
    if vt == "camion_estandar" and svc.price_camion_estandar is not None:
        return svc.price_camion_estandar
    if vt == "camion_xl" and svc.price_camion_xl is not None:
        return svc.price_camion_xl
    return svc.price_automovil


def _cat(item) -> str:
    """Return the category string of an item (handles both enum and plain str)."""
    c = item.service_category
    return c.value if hasattr(c, "value") else str(c)


def _std(item) -> Decimal:
    """Return the standard (catalog) price of an item, falling back to unit_price."""
    return item.standard_price or item.unit_price or Decimal("0")


def _pintura_pieces(standard_price: Decimal) -> Decimal:
    """Convert a pintura item standard price to piece count (¼ / ½ / 1 / 1.5 / 2)."""
    if standard_price >= Decimal("800000"):  return Decimal("2")
    if standard_price >= Decimal("600000"):  return Decimal("1.5")
    if standard_price >= Decimal("400000"):  return Decimal("1")
    if standard_price >= Decimal("150000"):  return Decimal("0.5")
    if standard_price >  Decimal("0"):       return Decimal("0.25")
    return Decimal("0")


def _real_pending(liq_record: models.WeekLiquidation | None, db: Session | None) -> Decimal | None:
    """Return the actual remaining pending amount for a liquidation record.

    If the linked debt exists and has been (partially) paid, reflects those payments.
    Falls back to liq_record.amount_pending if no linked debt found.
    """
    if not liq_record:
        return None
    if db is not None and liq_record.id is not None:
        debt = db.query(models.Debt).filter_by(
            week_liquidation_id=liq_record.id,
            direction="empresa_operario",
        ).first()
        if debt is not None:
            remaining = debt.amount - (debt.paid_amount or Decimal("0"))
            return max(Decimal("0"), remaining)
    return liq_record.amount_pending


def _liq_col(op_type: str) -> str:
    """Return the order column name used to track liquidation for this operator type."""
    if op_type == "latoneria":
        return "latoneria_liquidation_id"
    if op_type == "pintura":
        return "pintura_liquidation_id"
    return "week_liquidation_id"


def _get_liq_id(order, op_type: str):
    """Return the order's liquidation-tracking column value for this operator type."""
    return getattr(order, _liq_col(op_type))


def _is_liquidated(order, op_type: str, op_liq_ids: set | None) -> bool:
    liq_id = _get_liq_id(order, op_type)
    if liq_id is None:
        return False
    return op_liq_ids is None or liq_id in op_liq_ids


def _stamp_order(order, op_type: str, liq_id: int) -> None:
    """Stamp the appropriate liquidation-tracking column on an order."""
    setattr(order, _liq_col(op_type), liq_id)


def _build_week_response(
    operator: models.Operator,
    ws: date,
    we: date,
    qualifying: list,
    liq_record: models.WeekLiquidation | None,
    op_liq_ids: set[int] | None = None,
    db: Session | None = None,
) -> schemas.LiqWeekResponse:
    op_type = operator.operator_type or "detallado"
    relevant_cats = CATEGORY_MAP.get(op_type, DETALLADO_CATEGORIES)

    # For detallado: ceramic commission uses Signature service price
    signature_svc = (
        db.query(models.Service).filter(models.Service.name == "Signature").first()
        if db else None
    )

    days_map: dict[date, list] = {}
    cur = ws
    while cur <= we:
        days_map[cur] = []
        cur += timedelta(days=1)

    for order in qualifying:
        d = order.date if isinstance(order.date, date) else date.fromisoformat(str(order.date))
        if d in days_map:
            days_map[d].append(order)

    week_total = Decimal("0")
    total_piece_count = Decimal("0")
    commission_base = Decimal("0")
    week_ceramic_bonus = Decimal("0")
    total_services = 0

    days = []
    for d in sorted(days_map.keys()):
        day_orders = days_map[d]
        day_idx = d.isoweekday() % 7
        day_total = Decimal("0")
        day_order_schemas = []

        for o in day_orders:
            # Filter items to only those relevant to this operator type AND confirmed
            filtered = [i for i in o.items if _cat(i) in relevant_cats and i.is_confirmed]
            if not filtered:
                continue  # skip orders with no relevant items

            # Build item schemas + compute order total using standard_price
            item_schemas = []
            order_total = Decimal("0")
            order_pieces = Decimal("0")
            order_comm_base = Decimal("0")
            order_ceramic_bonus = Decimal("0")
            for item in filtered:
                sp = _std(item)
                item_schemas.append(schemas.LiqWeekOrderItem(
                    service_name=item.service_name,
                    service_category=_cat(item),
                    unit_price=sp,
                    standard_price=sp,
                    quantity=item.quantity,
                    subtotal=sp,
                ))
                order_total += sp
                if op_type == "pintura":
                    order_pieces += _pintura_pieces(sp)
                elif op_type not in ("latoneria",) and _cat(item) == "ceramico" and signature_svc:
                    order_comm_base += _signature_price(signature_svc, o.vehicle.type)
                    order_ceramic_bonus += CERAMIC_BONUSES.get(item.service_name, Decimal("0"))
                else:
                    order_comm_base += sp

            day_order_schemas.append(schemas.LiqWeekOrder(
                order_id=o.id,
                order_number=o.order_number,
                patio_status=o.patio_entry.status.value if hasattr(o.patio_entry.status, "value") else str(o.patio_entry.status),
                vehicle_plate=o.vehicle.plate,
                vehicle_brand=o.vehicle.brand,
                vehicle_model=o.vehicle.model,
                items=item_schemas,
                total=order_total,
                piece_count=order_pieces if op_type == "pintura" else None,
                latoneria_operator_pay=o.latoneria_operator_pay if op_type == "latoneria" else None,
                is_liquidated=_is_liquidated(o, op_type, op_liq_ids),
                commission_base=order_comm_base if op_type not in ("pintura", "latoneria") else None,
                ceramic_bonus=order_ceramic_bonus if op_type not in ("pintura", "latoneria") else None,
            ))
            day_total += order_total
            total_piece_count += order_pieces
            week_ceramic_bonus += order_ceramic_bonus

        total_services += len(day_order_schemas)
        week_total += day_total

        days.append(schemas.LiqWeekDay(
            date=str(d),
            day_name=DAY_NAMES[day_idx],
            orders=day_order_schemas,
            day_total=day_total,
            day_services=len(day_order_schemas),
        ))

    # ── Commission calculation by operator type ───────────────────────────────
    if op_type == "pintura":
        commission_base = week_total
        commission = (total_piece_count * PINTURA_PIECE_RATE).quantize(Decimal("0.01"))
        piece_count: Decimal | None = total_piece_count
    elif op_type == "latoneria":
        # Commission = sum of manually entered latoneria_operator_pay at delivery
        commission_base = week_total
        commission = sum(
            [o.latoneria_operator_pay or Decimal("0")
             for o in qualifying
             if any(_cat(i) in relevant_cats for i in o.items)],
            Decimal("0"),
        ).quantize(Decimal("0.01"))
        piece_count = None
    else:
        rate = Decimal(str(operator.commission_rate)) / Decimal("100")
        # commission_base uses Signature price for ceramic items (accumulated per-order above)
        commission_base = sum(
            (o.commission_base or Decimal("0"))
            for day in days for o in day.orders
        )
        commission = (rate * commission_base + week_ceramic_bonus).quantize(Decimal("0.01"))
        piece_count = None

    # Count unliquidated orders (only those that have relevant items)
    unliq_order_ids = set()
    for day in days:
        for o in day.orders:
            if not o.is_liquidated:
                unliq_order_ids.add(o.order_id)
    unliquidated_count = len(unliq_order_ids)

    return schemas.LiqWeekResponse(
        operator_id=operator.id,
        operator_name=operator.name,
        operator_type=op_type,
        commission_rate=operator.commission_rate,
        week_start=str(ws),
        week_end=str(we),
        days=days,
        week_total=week_total,
        commission_base=commission_base,
        week_services=total_services,
        piece_count=piece_count,
        commission_amount=commission,
        is_liquidated=liq_record is not None,
        unliquidated_count=unliquidated_count,
        liquidated_at=str(liq_record.liquidated_at) if liq_record else None,
        net_amount=liq_record.net_amount if liq_record else None,
        payment_cash_amount=liq_record.payment_cash if liq_record else None,
        payment_datafono_amount=liq_record.payment_datafono if liq_record else None,
        payment_nequi_amount=liq_record.payment_nequi if liq_record else None,
        payment_bancolombia_amount=liq_record.payment_bancolombia if liq_record else None,
        amount_pending=_real_pending(liq_record, db),
        ceramic_bonus_total=week_ceramic_bonus if week_ceramic_bonus else None,
    )


def _fetch_all_qualifying(op_id: int, db: Session, op_type: str = "detallado") -> list:
    """Like _fetch_qualifying but with no date filter — returns all qualifying orders ever."""
    from app.tz import today_bogota
    return _fetch_qualifying(op_id, date(2020, 1, 1), today_bogota(), db, op_type)


def _fetch_qualifying(op_id: int, ws: date, we: date, db: Session, op_type: str = "detallado") -> list:
    base_q = (
        db.query(models.ServiceOrder)
        .options(
            joinedload(models.ServiceOrder.items),
            joinedload(models.ServiceOrder.vehicle),
            joinedload(models.ServiceOrder.patio_entry),
        )
        .filter(
            models.ServiceOrder.date >= ws,
            models.ServiceOrder.date <= we,
        )
    )
    if op_type in ("pintura", "latoneria"):
        # All orders with at least one confirmed relevant item, regardless of assigned operator
        relevant = CATEGORY_MAP.get(op_type, set())
        orders = base_q.all()
        return [
            o for o in orders
            if o.patio_entry
            and o.patio_entry.status in QUALIFYING_STATUSES
            and any(_cat(i) in relevant and i.is_confirmed for i in o.items)
        ]
    else:
        orders = base_q.filter(models.ServiceOrder.operator_id == op_id).all()
        return [
            o for o in orders
            if o.patio_entry
            and o.patio_entry.status in QUALIFYING_STATUSES
            and any(_cat(i) in CATEGORY_MAP.get(op_type, DETALLADO_CATEGORIES) and i.is_confirmed for i in o.items)
        ]


@router.get("/{op_id}/week", response_model=schemas.LiqWeekResponse)
def get_week(op_id: int, week_start: str = Query(...), db: Session = Depends(get_db)):
    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")

    ws = date.fromisoformat(week_start)
    we = ws + timedelta(days=6)
    op_type = operator.operator_type or "detallado"
    qualifying = _fetch_qualifying(op_id, ws, we, db, op_type)
    liq = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()
    op_liq_ids = {
        r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()
    }

    return _build_week_response(operator, ws, we, qualifying, liq, op_liq_ids, db=db)


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
    op_type = operator.operator_type or "detallado"

    qualifying = _fetch_qualifying(op_id, ws, we, db, op_type)
    existing   = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()
    op_liq_ids = {
        r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()
    }

    # Filter to orders not yet liquidated by this operator
    unliquidated = [o for o in qualifying if not _is_liquidated(o, op_type, op_liq_ids)]
    if not unliquidated:
        return _build_week_response(operator, ws, we, qualifying, existing, op_liq_ids, db=db)

    # ── Commission calculation (uses standard_price, filtered by category) ────
    relevant_cats = CATEGORY_MAP.get(op_type, DETALLADO_CATEGORIES)

    if op_type == "pintura":
        liq_piece_count = sum(
            _pintura_pieces(_std(item))
            for o in unliquidated for item in o.items
            if _cat(item) in relevant_cats and item.is_confirmed
        )
        new_commission = (liq_piece_count * PINTURA_PIECE_RATE).quantize(Decimal("0.01"))
        new_commission_base = sum(
            _std(item)
            for o in unliquidated for item in o.items
            if _cat(item) in relevant_cats and item.is_confirmed
        )
    elif op_type == "latoneria":
        new_commission_base = sum(
            [_std(item)
             for o in unliquidated for item in o.items
             if _cat(item) in relevant_cats and item.is_confirmed],
            Decimal("0"),
        )
        new_commission = sum(
            [o.latoneria_operator_pay or Decimal("0") for o in unliquidated],
            Decimal("0"),
        ).quantize(Decimal("0.01"))
    else:
        rate = Decimal(str(operator.commission_rate)) / Decimal("100")
        signature_svc = db.query(models.Service).filter(models.Service.name == "Signature").first()
        new_commission_base = Decimal("0")
        new_ceramic_bonus = Decimal("0")
        for o in unliquidated:
            for item in o.items:
                if _cat(item) not in relevant_cats or not item.is_confirmed:
                    continue
                if _cat(item) == "ceramico" and signature_svc:
                    new_commission_base += _signature_price(signature_svc, o.vehicle.type)
                    new_ceramic_bonus += CERAMIC_BONUSES.get(item.service_name, Decimal("0"))
                else:
                    new_commission_base += _std(item)
        new_commission = (rate * new_commission_base + new_ceramic_bonus).quantize(Decimal("0.01"))

    new_gross = new_commission_base  # for the liquidation record

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
    total_paid = (body.payment_cash + body.payment_datafono + body.payment_nequi + body.payment_bancolombia).quantize(Decimal("0.01"))
    amount_pending = max(Decimal("0"), net_amount - total_paid).quantize(Decimal("0.01"))

    if existing:
        # Update the existing liquidation record with the incremental amounts
        existing.total_amount      = (existing.total_amount      or Decimal("0")) + new_gross
        existing.commission_amount = (existing.commission_amount or Decimal("0")) + new_commission
        existing.net_amount           = (existing.net_amount           or Decimal("0")) + net_amount
        existing.payment_cash         = (existing.payment_cash         or Decimal("0")) + body.payment_cash
        existing.payment_datafono     = (existing.payment_datafono     or Decimal("0")) + body.payment_datafono
        existing.payment_nequi        = (existing.payment_nequi        or Decimal("0")) + body.payment_nequi
        existing.payment_bancolombia  = (existing.payment_bancolombia  or Decimal("0")) + body.payment_bancolombia
        existing.amount_pending       = (existing.amount_pending       or Decimal("0")) + amount_pending
        liq = existing
    else:
        liq = models.WeekLiquidation(
            operator_id=op_id,
            week_start=ws,
            total_amount=new_gross,
            commission_amount=new_commission,
            net_amount=net_amount,
            payment_cash=body.payment_cash,
            payment_datafono=body.payment_datafono,
            payment_nequi=body.payment_nequi,
            payment_bancolombia=body.payment_bancolombia,
            amount_pending=amount_pending,
        )
        db.add(liq)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            existing = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()
            return _build_week_response(operator, ws, we, qualifying, existing, op_liq_ids, db=db)

    # Stamp unliquidated orders with this liquidation's id
    for o in unliquidated:
        _stamp_order(o, op_type, liq.id)

    # Auto-create empresa→operario debt for any pending amount
    if amount_pending > 0:
        pending_debt = models.Debt(
            operator_id=op_id,
            direction="empresa_operario",
            amount=amount_pending,
            description=f"Pendiente liquidación semana {week_start}",
            week_liquidation_id=liq.id,
        )
        db.add(pending_debt)

    db.commit()
    db.refresh(liq)

    # Auto-create expense records for each payment method used
    liq_desc = f"Pago operario {operator.name} · semana {week_start}"
    any_payment = False
    for amt, method_label in [
        (body.payment_cash,        "Efectivo"),
        (body.payment_datafono,    "Datáfono"),
        (body.payment_nequi,       "Nequi"),
        (body.payment_bancolombia, "Bancolombia"),
    ]:
        if amt > 0:
            db.add(models.Expense(
                date=ws,
                amount=amt,
                category="Salarios",
                description=liq_desc,
                payment_method=method_label,
            ))
            any_payment = True
    if any_payment:
        db.commit()

    # Link debt payments to this liquidation
    all_debt_ids = [a.debt_id for a in body.abonos] + [s.debt_id for s in body.company_settlements]
    if all_debt_ids:
        db.query(models.DebtPayment).filter(
            models.DebtPayment.liquidation_id.is_(None),
            models.DebtPayment.debt_id.in_(all_debt_ids),
        ).update({"liquidation_id": liq.id}, synchronize_session=False)
        db.commit()

    qualifying = _fetch_qualifying(op_id, ws, we, db, op_type)
    op_liq_ids = {
        r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()
    }
    return _build_week_response(operator, ws, we, qualifying, liq, op_liq_ids, db=db)


@router.get("/{op_id}/pending", response_model=schemas.LiqWeekResponse)
def get_all_pending(op_id: int, db: Session = Depends(get_db)):
    """Return all unliquidated qualifying orders for an operator (across all weeks)."""
    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")
    op_type = operator.operator_type or "detallado"
    qualifying = _fetch_all_qualifying(op_id, db, op_type)
    op_liq_ids = {r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()}
    unliquidated = [o for o in qualifying if not _is_liquidated(o, op_type, op_liq_ids)]

    from app.tz import today_bogota
    today = today_bogota()
    if not unliquidated:
        return _build_week_response(operator, today, today, [], None, op_liq_ids, db=db)

    def _ord_date(o) -> date:
        return o.date if isinstance(o.date, date) else date.fromisoformat(str(o.date))

    min_date = min(_ord_date(o) for o in unliquidated)
    return _build_week_response(operator, min_date, today, unliquidated, None, op_liq_ids, db=db)


@router.post("/{op_id}/liquidate-pending", response_model=schemas.LiqWeekResponse)
def liquidate_all_pending(
    op_id: int,
    body: schemas.LiquidatePayload = schemas.LiquidatePayload(),
    db: Session = Depends(get_db),
):
    """Liquidate ALL unliquidated orders for an operator at once (across all weeks)."""
    from collections import defaultdict
    from app.tz import today_bogota

    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")

    op_type = operator.operator_type or "detallado"
    relevant_cats = CATEGORY_MAP.get(op_type, DETALLADO_CATEGORIES)

    qualifying = _fetch_all_qualifying(op_id, db, op_type)
    op_liq_ids = {r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()}
    unliquidated = [o for o in qualifying if not _is_liquidated(o, op_type, op_liq_ids)]

    today = today_bogota()
    if not unliquidated:
        return _build_week_response(operator, today, today, qualifying, None, op_liq_ids, db=db)

    def _ord_date(o) -> date:
        return o.date if isinstance(o.date, date) else date.fromisoformat(str(o.date))

    def _week_start(d: date) -> date:
        return d - timedelta(days=d.isoweekday() % 7)

    # ── Commission per week ───────────────────────────────────────────────────
    weeks_orders: dict[date, list] = defaultdict(list)
    for o in unliquidated:
        weeks_orders[_week_start(_ord_date(o))].append(o)

    week_commissions: dict[date, Decimal] = {}
    week_gross_map:   dict[date, Decimal] = {}
    total_commission = Decimal("0")
    rate = Decimal(str(operator.commission_rate)) / Decimal("100")
    signature_svc_lp = db.query(models.Service).filter(models.Service.name == "Signature").first() if op_type not in ("pintura", "latoneria") else None

    for ws, orders in weeks_orders.items():
        if op_type == "pintura":
            pieces = sum(
                _pintura_pieces(_std(i))
                for o in orders for i in o.items if _cat(i) in relevant_cats
            )
            comm = (pieces * PINTURA_PIECE_RATE).quantize(Decimal("0.01"))
            gross = sum(_std(i) for o in orders for i in o.items if _cat(i) in relevant_cats)
        elif op_type == "latoneria":
            gross = sum(_std(i) for o in orders for i in o.items if _cat(i) in relevant_cats)
            comm = sum(
                [o.latoneria_operator_pay or Decimal("0") for o in orders],
                Decimal("0"),
            ).quantize(Decimal("0.01"))
        else:
            gross = Decimal("0")
            ceramic_bonus_lp = Decimal("0")
            for o in orders:
                for i in o.items:
                    if _cat(i) not in relevant_cats:
                        continue
                    if _cat(i) == "ceramico" and signature_svc_lp:
                        gross += _signature_price(signature_svc_lp, o.vehicle.type)
                        ceramic_bonus_lp += CERAMIC_BONUSES.get(i.service_name, Decimal("0"))
                    else:
                        gross += _std(i)
            comm  = (rate * gross + ceramic_bonus_lp).quantize(Decimal("0.01"))
        week_commissions[ws] = comm
        week_gross_map[ws]   = gross
        total_commission += comm

    # ── Abonos operario→empresa ───────────────────────────────────────────────
    total_abonos = Decimal("0")
    for abono in body.abonos:
        if abono.amount <= 0:
            continue
        debt = db.query(models.Debt).filter_by(id=abono.debt_id, operator_id=op_id).first()
        if not debt or debt.direction != "operario_empresa":
            continue
        remaining = debt.amount - (debt.paid_amount or Decimal("0"))
        pay = min(abono.amount, remaining)
        db.add(models.DebtPayment(debt_id=debt.id, amount=pay))
        debt.paid_amount = (debt.paid_amount or Decimal("0")) + pay
        if debt.paid_amount >= debt.amount:
            debt.paid = True
        total_abonos += pay

    # ── Empresa→operario settlements ─────────────────────────────────────────
    total_settled = Decimal("0")
    for settlement in body.company_settlements:
        if settlement.amount <= 0:
            continue
        debt = db.query(models.Debt).filter_by(id=settlement.debt_id, operator_id=op_id).first()
        if not debt or debt.direction != "empresa_operario":
            continue
        remaining = debt.amount - (debt.paid_amount or Decimal("0"))
        pay = min(settlement.amount, remaining)
        db.add(models.DebtPayment(debt_id=debt.id, amount=pay))
        debt.paid_amount = (debt.paid_amount or Decimal("0")) + pay
        if debt.paid_amount >= debt.amount:
            debt.paid = True
        total_settled += pay

    db.flush()

    net_amount   = (total_commission - total_abonos + total_settled).quantize(Decimal("0.01"))
    total_paid   = (body.payment_cash + body.payment_datafono + body.payment_nequi + body.payment_bancolombia).quantize(Decimal("0.01"))
    amount_pending = max(Decimal("0"), net_amount - total_paid).quantize(Decimal("0.01"))

    # ── Create one WeekLiquidation per week (payments distributed proportionally) ─
    sorted_weeks = sorted(weeks_orders.keys())
    all_liq_ids: list[int] = []
    last_liq_id: int | None = None

    for idx, ws in enumerate(sorted_weeks):
        we = ws + timedelta(days=6)
        orders = weeks_orders[ws]

        if total_commission > 0:
            ratio = week_commissions[ws] / total_commission
        else:
            ratio = Decimal("1") / len(sorted_weeks)

        # Give the last week the remainder to avoid rounding drift
        if idx == len(sorted_weeks) - 1:
            def _prev_sum(base: Decimal) -> Decimal:
                return sum(
                    ((base * week_commissions[w] / total_commission).quantize(Decimal("0.01"))
                     for w in sorted_weeks[:-1]),
                    Decimal("0"),
                ) if total_commission > 0 else Decimal("0")
            week_cash        = (body.payment_cash        - _prev_sum(body.payment_cash)).quantize(Decimal("0.01"))
            week_datafono    = (body.payment_datafono    - _prev_sum(body.payment_datafono)).quantize(Decimal("0.01"))
            week_nequi       = (body.payment_nequi       - _prev_sum(body.payment_nequi)).quantize(Decimal("0.01"))
            week_bancolombia = (body.payment_bancolombia - _prev_sum(body.payment_bancolombia)).quantize(Decimal("0.01"))
            week_pending     = (amount_pending           - _prev_sum(amount_pending)).quantize(Decimal("0.01"))
            week_net         = (net_amount               - _prev_sum(net_amount)).quantize(Decimal("0.01"))
        else:
            week_cash        = (body.payment_cash        * ratio).quantize(Decimal("0.01"))
            week_datafono    = (body.payment_datafono    * ratio).quantize(Decimal("0.01"))
            week_nequi       = (body.payment_nequi       * ratio).quantize(Decimal("0.01"))
            week_bancolombia = (body.payment_bancolombia * ratio).quantize(Decimal("0.01"))
            week_pending     = (amount_pending           * ratio).quantize(Decimal("0.01"))
            week_net         = (net_amount               * ratio).quantize(Decimal("0.01"))

        existing = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()
        if existing:
            existing.total_amount      = (existing.total_amount      or Decimal("0")) + week_gross_map[ws]
            existing.commission_amount = (existing.commission_amount or Decimal("0")) + week_commissions[ws]
            existing.net_amount        = (existing.net_amount        or Decimal("0")) + week_net
            existing.payment_cash      = (existing.payment_cash      or Decimal("0")) + week_cash
            existing.payment_datafono  = (existing.payment_datafono  or Decimal("0")) + week_datafono
            existing.payment_nequi     = (existing.payment_nequi     or Decimal("0")) + week_nequi
            existing.payment_bancolombia = (existing.payment_bancolombia or Decimal("0")) + week_bancolombia
            existing.amount_pending    = (existing.amount_pending    or Decimal("0")) + week_pending
            liq = existing
        else:
            liq = models.WeekLiquidation(
                operator_id=op_id, week_start=ws,
                total_amount=week_gross_map[ws],
                commission_amount=week_commissions[ws],
                net_amount=week_net,
                payment_cash=week_cash,
                payment_datafono=week_datafono,
                payment_nequi=week_nequi,
                payment_bancolombia=week_bancolombia,
                amount_pending=week_pending,
            )
            db.add(liq)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                liq = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=ws).first()

        for o in orders:
            _stamp_order(o, op_type, liq.id)
        all_liq_ids.append(liq.id)
        last_liq_id = liq.id

    # ── Pending debt ──────────────────────────────────────────────────────────
    if amount_pending > 0:
        db.add(models.Debt(
            operator_id=op_id,
            direction="empresa_operario",
            amount=amount_pending,
            description=f"Pendiente liquidación {today}",
            week_liquidation_id=last_liq_id,
        ))

    db.commit()

    # ── Expense records (one per method, not per week) ────────────────────────
    for amt, label in [
        (body.payment_cash,        "Efectivo"),
        (body.payment_datafono,    "Datáfono"),
        (body.payment_nequi,       "Nequi"),
        (body.payment_bancolombia, "Bancolombia"),
    ]:
        if amt > 0:
            db.add(models.Expense(
                date=today,
                amount=amt,
                category="Salarios",
                description=f"Pago operario {operator.name}",
                payment_method=label,
            ))
    db.commit()

    # ── Link debt payments to last liquidation ────────────────────────────────
    all_debt_ids = [a.debt_id for a in body.abonos] + [s.debt_id for s in body.company_settlements]
    if all_debt_ids and last_liq_id:
        db.query(models.DebtPayment).filter(
            models.DebtPayment.liquidation_id.is_(None),
            models.DebtPayment.debt_id.in_(all_debt_ids),
        ).update({"liquidation_id": last_liq_id}, synchronize_session=False)
        db.commit()

    # ── Return updated view ───────────────────────────────────────────────────
    op_liq_ids = {r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()}
    return _build_week_response(operator, today, today, [], None, op_liq_ids, db=db)


@router.post("/{op_id}/pay-debts", response_model=list[schemas.DebtOut])
def pay_empresa_debts(
    op_id: int,
    body: schemas.LiquidatePayload = schemas.LiquidatePayload(),
    db: Session = Depends(get_db),
):
    """Pay empresa→operario debts (company paying operator) with payment methods.
    Applies total payment to unpaid debts oldest-first. Creates Expense records."""
    from app.tz import today_bogota
    operator = db.query(models.Operator).filter_by(id=op_id).first()
    if not operator:
        raise HTTPException(404, "Operario no encontrado")

    total_payment = (
        body.payment_cash + body.payment_datafono +
        body.payment_nequi + body.payment_bancolombia
    ).quantize(Decimal("0.01"))
    if total_payment <= 0:
        raise HTTPException(400, "Monto de pago debe ser mayor a 0")

    # Load unpaid empresa→operario debts oldest first
    unpaid_debts = (
        db.query(models.Debt)
        .options(joinedload(models.Debt.payments))
        .filter_by(operator_id=op_id, direction="empresa_operario", paid=False)
        .order_by(models.Debt.created_at.asc())
        .all()
    )

    remaining_payment = total_payment
    for debt in unpaid_debts:
        if remaining_payment <= 0:
            break
        debt_remaining = debt.amount - (debt.paid_amount or Decimal("0"))
        pay = min(remaining_payment, debt_remaining)
        db.add(models.DebtPayment(debt_id=debt.id, amount=pay))
        debt.paid_amount = (debt.paid_amount or Decimal("0")) + pay
        if debt.paid_amount >= debt.amount:
            debt.paid = True
        remaining_payment -= pay

    today = today_bogota()
    for amt, label in [
        (body.payment_cash,        "Efectivo"),
        (body.payment_datafono,    "Datáfono"),
        (body.payment_nequi,       "Nequi"),
        (body.payment_bancolombia, "Bancolombia"),
    ]:
        if amt > 0:
            db.add(models.Expense(
                date=today,
                amount=amt,
                category="Salarios",
                description=f"Pago deuda operario {operator.name}",
                payment_method=label,
            ))

    db.commit()

    return (
        db.query(models.Debt)
        .options(joinedload(models.Debt.payments))
        .filter_by(operator_id=op_id)
        .order_by(models.Debt.created_at.desc())
        .all()
    )


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

    op_type = operator.operator_type or "detallado"
    relevant_cats = CATEGORY_MAP.get(op_type, DETALLADO_CATEGORIES)
    qualifying = _fetch_qualifying(op_id, ds, de, db, op_type)
    rate = Decimal(str(operator.commission_rate)) / Decimal("100")
    op_liq_ids = {
        r.id for r in db.query(models.WeekLiquidation.id).filter_by(operator_id=op_id).all()
    }

    # Build report orders with filtered items + standard prices
    orders = []
    gross_total = Decimal("0")
    total_pieces = Decimal("0")
    report_ceramic_bonus_total = Decimal("0")
    signature_svc_report = db.query(models.Service).filter(models.Service.name == "Signature").first() if op_type not in ("pintura", "latoneria") else None
    for o in sorted(qualifying, key=lambda x: x.date):
        filtered = [i for i in o.items if _cat(i) in relevant_cats]
        if not filtered:
            continue
        order_total = sum(_std(i) for i in filtered)
        gross_total += order_total
        order_pieces = sum(_pintura_pieces(_std(i)) for i in filtered) if op_type == "pintura" else Decimal("0")
        total_pieces += order_pieces
        # Per-order commission base (ceramic substitution)
        order_comm_base = Decimal("0")
        order_ceramic_bonus_r = Decimal("0")
        if op_type not in ("pintura", "latoneria"):
            for i in filtered:
                if _cat(i) == "ceramico" and signature_svc_report:
                    order_comm_base += _signature_price(signature_svc_report, o.vehicle.type)
                    order_ceramic_bonus_r += CERAMIC_BONUSES.get(i.service_name, Decimal("0"))
                else:
                    order_comm_base += _std(i)
            report_ceramic_bonus_total += order_ceramic_bonus_r
        orders.append(schemas.ReportOrder(
            order_number=o.order_number,
            date=str(o.date),
            vehicle_plate=o.vehicle.plate,
            vehicle_brand=o.vehicle.brand,
            vehicle_model=o.vehicle.model,
            items=[
                schemas.ReportOrderItem(
                    service_name=i.service_name,
                    service_category=_cat(i),
                    unit_price=_std(i),
                    quantity=i.quantity,
                    subtotal=_std(i),
                    latoneria_operator_pay=i.latoneria_operator_pay if op_type == "latoneria" else None,
                )
                for i in filtered
            ],
            total=order_total,
            piece_count=order_pieces if op_type == "pintura" else None,
            latoneria_operator_pay=o.latoneria_operator_pay if op_type == "latoneria" else None,
            is_liquidated=_is_liquidated(o, op_type, op_liq_ids),
            commission_base=order_comm_base if op_type not in ("pintura", "latoneria") else None,
            ceramic_bonus=order_ceramic_bonus_r if op_type not in ("pintura", "latoneria") else None,
        ))

    if op_type == "pintura":
        commission = (total_pieces * PINTURA_PIECE_RATE).quantize(Decimal("0.01"))
    elif op_type == "latoneria":
        commission = sum(
            o.latoneria_operator_pay or Decimal("0") for o in qualifying
        ).quantize(Decimal("0.01"))
    else:
        # Commission base uses Signature price for ceramic items
        report_commission_base = sum(
            (o.commission_base or Decimal("0")) for o in orders
        )
        commission = (rate * report_commission_base + report_ceramic_bonus_total).quantize(Decimal("0.01"))

    # ── Per-week liquidation status (Sunday-based weeks) ──────────────────────
    # Find the first Sunday on or before ds
    first_sunday = ds - timedelta(days=ds.isoweekday() % 7)
    week_statuses: list[schemas.ReportWeekStatus] = []
    cur = first_sunday
    while cur <= de:
        ws_end = cur + timedelta(days=6)
        liq = db.query(models.WeekLiquidation).filter_by(operator_id=op_id, week_start=cur).first()
        week_orders = [o for o in qualifying if cur <= o.date <= ws_end]
        # Compute filtered gross for this week
        wk_gross = Decimal("0")
        wk_pieces = Decimal("0")
        wk_comm_base = Decimal("0")
        wk_ceramic_bonus = Decimal("0")
        for wo in week_orders:
            for i in wo.items:
                if _cat(i) in relevant_cats:
                    wk_gross += _std(i)
                    if op_type == "pintura":
                        wk_pieces += _pintura_pieces(_std(i))
                    elif op_type not in ("latoneria",) and _cat(i) == "ceramico" and signature_svc_report:
                        wk_comm_base += _signature_price(signature_svc_report, wo.vehicle.type)
                        wk_ceramic_bonus += CERAMIC_BONUSES.get(i.service_name, Decimal("0"))
                    else:
                        wk_comm_base += _std(i)
        if op_type == "pintura":
            wk_comm = (wk_pieces * PINTURA_PIECE_RATE).quantize(Decimal("0.01"))
        elif op_type == "latoneria":
            wk_comm = sum(
                o.latoneria_operator_pay or Decimal("0") for o in week_orders
            ).quantize(Decimal("0.01"))
        else:
            wk_comm = (rate * wk_comm_base + wk_ceramic_bonus).quantize(Decimal("0.01"))
        # Week is fully liquidated only when ALL its orders are stamped with this operator's liq
        all_liquidated = len(week_orders) > 0 and all(
            _is_liquidated(o, op_type, op_liq_ids) for o in week_orders
        )
        week_statuses.append(schemas.ReportWeekStatus(
            week_start=str(cur),
            week_end=str(ws_end),
            is_liquidated=all_liquidated,
            week_gross=wk_gross,
            week_commission=wk_comm,
            week_pieces=wk_pieces if op_type == "pintura" else None,
            net_amount=liq.net_amount if liq else None,
            payment_cash=liq.payment_cash if liq else None,
            payment_datafono=liq.payment_datafono if liq else None,
            payment_nequi=liq.payment_nequi if liq else None,
            payment_bancolombia=liq.payment_bancolombia if liq else None,
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
        operator_type=op_type,
        commission_rate=operator.commission_rate,
        period_label=period_label,
        date_start=str(ds),
        date_end=str(de),
        orders=orders,
        total_services=len(qualifying),
        gross_total=gross_total,
        total_pieces=total_pieces if op_type == "pintura" else None,
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
