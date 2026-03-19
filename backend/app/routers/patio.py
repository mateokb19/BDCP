from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas

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
            joinedload(models.PatioEntry.vehicle),
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
        joinedload(models.PatioEntry.vehicle),
        joinedload(models.PatioEntry.order).joinedload(models.ServiceOrder.items),
    )
    if status:
        try:
            status_enum = models.PatioStatusEnum(status)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Estado inválido: {status}")
        q = q.filter(models.PatioEntry.status == status_enum)
    return q.order_by(models.PatioEntry.entered_at.desc()).all()


@router.post("/{id}/advance", response_model=schemas.PatioEntryOut)
def advance_status(id: int, db: Session = Depends(get_db)):
    """Advance patio entry to the next status."""
    entry = _get_entry_or_404(id, db)
    next_status = NEXT_STATUS.get(entry.status)
    if next_status is None:
        raise HTTPException(status_code=400, detail="El vehículo ya fue entregado")

    now = datetime.now(timezone.utc)
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

    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{id}", response_model=schemas.PatioEntryOut)
def edit_patio_entry(id: int, payload: schemas.PatioPatch, db: Session = Depends(get_db)):
    """
    Edit the non-mandatory fields of a patio entry:
    - vehicle.model, vehicle.color
    - order.operator_id
    - patio notes
    """
    entry = _get_entry_or_404(id, db)

    # Update vehicle
    if payload.model is not None:
        entry.vehicle.model = payload.model
    if payload.color is not None:
        entry.vehicle.color = payload.color

    # Update order's operator
    if payload.operator_id is not None:
        op = db.query(models.Operator).filter(
            models.Operator.id == payload.operator_id,
            models.Operator.active == True,
        ).first()
        if not op:
            raise HTTPException(status_code=404, detail="Operario no encontrado")
        entry.order.operator_id = payload.operator_id
    elif "operator_id" in payload.model_fields_set:
        # Explicit null → unassign
        entry.order.operator_id = None

    if payload.notes is not None:
        entry.notes = payload.notes

    db.commit()
    db.refresh(entry)
    return entry
