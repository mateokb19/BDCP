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
        entry.delivered_at           = now
        entry.order.status           = models.OrderStatusEnum.entregado
        entry.order.payment_cash        = payload.payment_cash
        entry.order.payment_datafono    = payload.payment_datafono
        entry.order.payment_nequi       = payload.payment_nequi
        entry.order.payment_bancolombia = payload.payment_bancolombia
        entry.order.paid                = True
        if payload.latoneria_operator_pay is not None:
            entry.order.latoneria_operator_pay = payload.latoneria_operator_pay

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

            new_items = []
            for svc in services:
                p = _price(svc)
                new_items.append(models.ServiceOrderItem(
                    order_id=entry.order_id,
                    service_id=svc.id,
                    service_name=svc.name,
                    service_category=svc.category,
                    unit_price=p,
                    standard_price=p,
                    quantity=1,
                    subtotal=p,
                ))
            db.add_all(new_items)
            total = sum(_price(s) for s in services)
        else:
            # All services removed — client left without service, total = 0
            total = 0

        entry.order.subtotal = total
        entry.order.total    = total

    if payload.notes is not None:
        entry.notes = payload.notes

    if "scheduled_delivery_at" in payload.model_fields_set:
        entry.scheduled_delivery_at = payload.scheduled_delivery_at

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
