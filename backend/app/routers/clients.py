from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/clients", tags=["clients"])


def _build_client_out(c: models.Client) -> schemas.ClientOut:
    order_count = 0
    total_spent = Decimal("0")
    last_service = None
    for v in c.vehicles:
        for o in v.orders:
            if o.status != "cancelado":
                order_count += 1
                total_spent += Decimal(str(o.total))
                if last_service is None or o.date > last_service:
                    last_service = o.date
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
    )


@router.get("", response_model=list[schemas.ClientOut])
def list_clients(search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Client)
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
    c = db.query(models.Client).filter(models.Client.id == client_id).first()
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
