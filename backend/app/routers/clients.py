from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/clients", tags=["clients"])


def _build_client_out(c: models.Client) -> schemas.ClientOut:
    order_count           = 0
    total_spent           = Decimal("0")
    last_service          = None
    pending_credit_total  = Decimal("0")
    for v in c.vehicles:
        for o in v.orders:
            if o.status != "cancelado":
                order_count += 1
                total_spent += Decimal(str(o.total))
                if last_service is None or o.date > last_service:
                    last_service = o.date
            if o.is_client_credit and o.client_credit_paid_at is None and o.status != "cancelado":
                pending_credit_total += Decimal(str(o.total)) - Decimal(str(o.downpayment))
    return schemas.ClientOut(
        id=c.id,
        name=c.name,
        phone=c.phone,
        email=c.email,
        tipo_persona=c.tipo_persona,
        tipo_identificacion=c.tipo_identificacion,
        identificacion=c.identificacion,
        dv=c.dv,
        notes=c.notes,
        created_at=c.created_at,
        vehicles=[schemas.ClientVehicleOut.model_validate(v) for v in c.vehicles],
        order_count=order_count,
        total_spent=total_spent,
        last_service=last_service,
        pending_credit_total=pending_credit_total,
    )


@router.get("", response_model=list[schemas.ClientOut])
def list_clients(search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Client).options(
        joinedload(models.Client.vehicles)
        .joinedload(models.Vehicle.orders)
        .joinedload(models.ServiceOrder.patio_entry),
        joinedload(models.Client.vehicles)
        .joinedload(models.Vehicle.orders)
        .joinedload(models.ServiceOrder.items),
    )
    if search:
        term = f"%{search}%"
        q = q.filter(
            models.Client.name.ilike(term) |
            models.Client.phone.ilike(term) |
            models.Client.vehicles.any(models.Vehicle.plate.ilike(term))
        )
    clients = q.order_by(models.Client.name).all()
    return [_build_client_out(c) for c in clients]


@router.patch("/{client_id}", response_model=schemas.ClientOut)
def patch_client(client_id: int, data: schemas.ClientPatch, db: Session = Depends(get_db)):
    c = (
        db.query(models.Client)
        .options(
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.patio_entry),
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.items),
        )
        .filter(models.Client.id == client_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if data.name                is not None: c.name                = data.name
    if data.phone               is not None: c.phone               = data.phone
    if data.email               is not None: c.email               = data.email
    if data.tipo_persona        is not None: c.tipo_persona        = data.tipo_persona
    if data.tipo_identificacion is not None: c.tipo_identificacion = data.tipo_identificacion
    if data.identificacion      is not None: c.identificacion      = data.identificacion
    if data.dv                  is not None: c.dv                  = data.dv
    if data.notes               is not None: c.notes               = data.notes
    db.commit()
    db.refresh(c)
    return _build_client_out(c)


@router.get("/{client_id}/credits", response_model=list[schemas.ClientCreditOut])
def list_client_credits(client_id: int, db: Session = Depends(get_db)):
    """List all pending (unpaid) credit orders for a client."""
    c = (
        db.query(models.Client)
        .options(
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.patio_entry),
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.items),
        )
        .filter(models.Client.id == client_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    results = []
    for v in c.vehicles:
        for o in v.orders:
            if not o.is_client_credit or o.client_credit_paid_at is not None:
                continue
            delivered_at = "—"
            if o.patio_entry and o.patio_entry.delivered_at:
                delivered_at = str(o.patio_entry.delivered_at.date())
            brand_model = f"{v.brand or ''} {v.model or ''}".strip() or v.plate
            services = ", ".join(i.service_name for i in o.items)
            amount = Decimal(str(o.total)) - Decimal(str(o.downpayment))
            results.append(schemas.ClientCreditOut(
                order_id=o.id,
                order_number=o.order_number or f"#{o.id}",
                delivered_at=delivered_at,
                plate=v.plate,
                vehicle=brand_model,
                services=services,
                amount=amount,
            ))
    results.sort(key=lambda x: x.delivered_at)
    return results


@router.post("/{client_id}/credits/pay", response_model=list[schemas.ClientCreditOut])
def pay_client_credits(
    client_id: int,
    data: schemas.ClientCreditPayment,
    db: Session = Depends(get_db),
):
    """Record payment for all pending credit orders for a client.
    Payment amounts are distributed proportionally by order weight.
    Returns empty list when all debts are paid."""
    from app.tz import now_bogota

    c = (
        db.query(models.Client)
        .options(
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.patio_entry),
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.items),
        )
        .filter(models.Client.id == client_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Collect pending credit orders across all vehicles
    pending: list[tuple[models.ServiceOrder, Decimal]] = []
    for v in c.vehicles:
        for o in v.orders:
            if o.is_client_credit and o.client_credit_paid_at is None:
                amount = Decimal(str(o.total)) - Decimal(str(o.downpayment))
                if amount > 0:
                    pending.append((o, amount))

    if not pending:
        return []

    total_debt = sum(amt for _, amt in pending)
    total_paid = (
        Decimal(str(data.payment_cash)) +
        Decimal(str(data.payment_datafono)) +
        Decimal(str(data.payment_nequi)) +
        Decimal(str(data.payment_bancolombia))
    )

    if total_paid <= 0:
        raise HTTPException(status_code=400, detail="El monto pagado debe ser mayor a 0")
    if total_paid < total_debt:
        raise HTTPException(
            status_code=400,
            detail=f"El pago (${total_paid:,.0f}) no cubre la deuda total (${total_debt:,.0f})"
        )
    if total_paid > total_debt:
        raise HTTPException(
            status_code=400,
            detail=f"El pago (${total_paid:,.0f}) supera la deuda total (${total_debt:,.0f})"
        )

    now = now_bogota()

    # Distribute payment proportionally; apply remainder to last order
    for i, (order, order_amt) in enumerate(pending):
        weight = order_amt / total_debt
        if i < len(pending) - 1:
            order.payment_cash        = (Decimal(str(data.payment_cash))        * weight).quantize(Decimal("0.01"))
            order.payment_datafono    = (Decimal(str(data.payment_datafono))    * weight).quantize(Decimal("0.01"))
            order.payment_nequi       = (Decimal(str(data.payment_nequi))       * weight).quantize(Decimal("0.01"))
            order.payment_bancolombia = (Decimal(str(data.payment_bancolombia)) * weight).quantize(Decimal("0.01"))
        else:
            # Last order gets the remainder to avoid rounding loss
            already_cash        = sum(o.payment_cash        for o, _ in pending[:-1])
            already_datafono    = sum(o.payment_datafono    for o, _ in pending[:-1])
            already_nequi       = sum(o.payment_nequi       for o, _ in pending[:-1])
            already_bancolombia = sum(o.payment_bancolombia for o, _ in pending[:-1])
            order.payment_cash        = Decimal(str(data.payment_cash))        - already_cash
            order.payment_datafono    = Decimal(str(data.payment_datafono))    - already_datafono
            order.payment_nequi       = Decimal(str(data.payment_nequi))       - already_nequi
            order.payment_bancolombia = Decimal(str(data.payment_bancolombia)) - already_bancolombia
        order.paid                = True
        order.client_credit_paid_at = now

    db.commit()
    return []   # all debts now paid
