from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas
from app.tz import now_bogota, today_bogota

router = APIRouter(prefix="/patio", tags=["patio"])

NEXT_STATUS = {
    models.PatioStatusEnum.esperando:  models.PatioStatusEnum.en_proceso,
    models.PatioStatusEnum.en_proceso: models.PatioStatusEnum.listo,
    models.PatioStatusEnum.listo:      models.PatioStatusEnum.entregado,
    models.PatioStatusEnum.entregado:  None,
}


def _get_entry_or_404(id: int, db: Session) -> models.PatioEntry:
    entry = (
        db.query(models.PatioEntry)
        .options(
            joinedload(models.PatioEntry.vehicle).joinedload(models.Vehicle.client),
            joinedload(models.PatioEntry.order).joinedload(models.ServiceOrder.items),
        )
        .filter(models.PatioEntry.id == id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada de patio no encontrada")
    return entry


@router.get("", response_model=list[schemas.PatioEntryOut])
def list_patio(
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List patio entries. Optionally filter by status."""
    q = db.query(models.PatioEntry).options(
        joinedload(models.PatioEntry.vehicle).joinedload(models.Vehicle.client),
        joinedload(models.PatioEntry.order).joinedload(models.ServiceOrder.items),
    )
    if status:
        try:
            status_enum = models.PatioStatusEnum(status)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Estado inválido: {status}")
        q = q.filter(models.PatioEntry.status == status_enum)
    else:
        # Show all non-delivered entries + only today's delivered entries
        today = today_bogota()
        q = q.filter(
            or_(
                models.PatioEntry.status != models.PatioStatusEnum.entregado,
                func.date(models.PatioEntry.delivered_at) == today,
            )
        )
    return q.order_by(models.PatioEntry.entered_at.desc()).all()


@router.post("/{id}/advance", response_model=schemas.PatioEntryOut)
def advance_status(id: int, payload: schemas.AdvancePayload = schemas.AdvancePayload(), db: Session = Depends(get_db)):
    """Advance patio entry to the next status. When advancing to 'entregado',
    optionally include payment_cash and payment_transfer amounts."""
    entry = _get_entry_or_404(id, db)
    next_status = NEXT_STATUS.get(entry.status)
    if next_status is None:
        raise HTTPException(status_code=400, detail="El vehículo ya fue entregado")

    now = now_bogota()
    entry.status = next_status
    if next_status == models.PatioStatusEnum.en_proceso:
        entry.started_at   = now
        entry.order.status = models.OrderStatusEnum.en_proceso
    elif next_status == models.PatioStatusEnum.listo:
        entry.completed_at = now
        entry.order.status = models.OrderStatusEnum.listo
    elif next_status == models.PatioStatusEnum.entregado:
        entry.delivered_at = now
        entry.order.status = models.OrderStatusEnum.entregado
        if payload.is_client_credit:
            # Client owes the restante — payment recorded later from Clientes page
            entry.order.is_client_credit     = True
            entry.order.payment_cash         = 0
            entry.order.payment_datafono     = 0
            entry.order.payment_nequi        = 0
            entry.order.payment_bancolombia  = 0
            entry.order.paid                 = False
        else:
            entry.order.payment_cash         = payload.payment_cash
            entry.order.payment_datafono     = payload.payment_datafono
            entry.order.payment_nequi        = payload.payment_nequi
            entry.order.payment_bancolombia  = payload.payment_bancolombia
            entry.order.paid                 = True

    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{id}", response_model=schemas.PatioEntryOut)
def edit_patio_entry(id: int, payload: schemas.PatioPatch, db: Session = Depends(get_db)):
    """
    Edit a patio entry:
    - vehicle.color
    - order.operator_id
    - order items (service_ids replaces all current items)
    - patio notes
    """
    entry = _get_entry_or_404(id, db)

    # Update vehicle color
    if payload.color is not None:
        entry.vehicle.color = payload.color

    # Update order's operator
    new_operator_id: int | None = entry.order.operator_id  # keep current by default
    if payload.operator_id is not None:
        op = db.query(models.Operator).filter(
            models.Operator.id == payload.operator_id,
            models.Operator.active == True,
        ).first()
        if not op:
            raise HTTPException(status_code=404, detail="Operario no encontrado")
        entry.order.operator_id = payload.operator_id
        new_operator_id = payload.operator_id
    elif "operator_id" in payload.model_fields_set:
        entry.order.operator_id = None
        new_operator_id = None

    # Sync operator to any ceramic treatments linked to this order
    if "operator_id" in payload.model_fields_set:
        db.query(models.CeramicTreatment).filter(
            models.CeramicTreatment.order_id == entry.order_id
        ).update({"operator_id": new_operator_id})

    # Replace order items if service_ids provided
    if payload.service_ids is not None:
        # Delete old items unconditionally
        db.query(models.ServiceOrderItem).filter(
            models.ServiceOrderItem.order_id == entry.order_id
        ).delete()

        if payload.service_ids:
            services = db.query(models.Service).filter(
                models.Service.id.in_(payload.service_ids),
                models.Service.active == True,
            ).all()
            if len(services) != len(set(payload.service_ids)):
                raise HTTPException(status_code=404, detail="Uno o más servicios no encontrados")

            vehicle_type = entry.vehicle.type
            def _price(svc):
                if vehicle_type == "camion_estandar":
                    return svc.price_camion_estandar or svc.price_automovil
                if vehicle_type == "camion_xl":
                    return svc.price_camion_xl or svc.price_automovil
                return svc.price_automovil

            # Build override map: service_id → custom unit_price
            override_map = {ov.service_id: ov.unit_price for ov in payload.item_overrides}

            new_items = []
            for svc in services:
                std = _price(svc)
                p = override_map.get(svc.id, std)
                new_items.append(models.ServiceOrderItem(
                    order_id=entry.order_id,
                    service_id=svc.id,
                    service_name=svc.name,
                    service_category=svc.category,
                    unit_price=p,
                    standard_price=std,
                    quantity=1,
                    subtotal=p,
                ))
            db.add_all(new_items)
            total = sum(i.subtotal for i in new_items)

            # Validate: new total cannot be less than downpayment
            downpayment = entry.order.downpayment or 0
            if total < downpayment:
                raise HTTPException(
                    status_code=400,
                    detail=f"El total (${total:,.0f}) no puede ser menor al abono (${downpayment:,.0f})"
                )
        else:
            # All services removed — client left without service, total = 0
            total = 0

        entry.order.subtotal = total
        entry.order.total    = total

    if payload.notes is not None:
        entry.notes = payload.notes

    if "scheduled_delivery_at" in payload.model_fields_set:
        entry.scheduled_delivery_at = payload.scheduled_delivery_at

    if payload.latoneria_operator_pays:
        lat_pay_map = {lp.service_id: lp.amount for lp in payload.latoneria_operator_pays}
        # Update per-item pay amounts
        for item in entry.order.items:
            if item.service_category == models.ServiceCategoryEnum.latoneria and item.service_id in lat_pay_map:
                item.latoneria_operator_pay = lat_pay_map[item.service_id]
        # Recalculate order-level total
        entry.order.latoneria_operator_pay = sum(
            (item.latoneria_operator_pay or 0)
            for item in entry.order.items
            if item.service_category == models.ServiceCategoryEnum.latoneria
        ) or None

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{id}", status_code=204)
def cancel_patio_entry(id: int, db: Session = Depends(get_db)):
    """Cancel a patio entry: delete all order items and the patio entry itself,
    and mark the order as cancelled. Only allowed while in 'esperando' status."""
    entry = _get_entry_or_404(id, db)
    if entry.status not in (models.PatioStatusEnum.esperando, models.PatioStatusEnum.en_proceso):
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar vehículos en espera o en proceso")

    # Delete order items
    db.query(models.ServiceOrderItem).filter(
        models.ServiceOrderItem.order_id == entry.order_id
    ).delete()

    # Cancel the order
    entry.order.status = models.OrderStatusEnum.cancelado

    # Remove patio entry
    db.delete(entry)
    db.commit()


@router.patch("/{entry_id}/items/{item_id}/confirm", response_model=schemas.PatioEntryOut)
def confirm_item(entry_id: int, item_id: int, db: Session = Depends(get_db)):
    """Toggle is_confirmed on a service order item (checklist check/uncheck)."""
    entry = _get_entry_or_404(entry_id, db)
    item = db.query(models.ServiceOrderItem).filter_by(
        id=item_id, order_id=entry.order_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    item.is_confirmed = not item.is_confirmed
    db.commit()
    return _get_entry_or_404(entry_id, db)
