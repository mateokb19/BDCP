from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/operators", tags=["operators"])


@router.get("", response_model=list[schemas.OperatorOut])
def list_operators(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(models.Operator)
    if not include_inactive:
        q = q.filter(models.Operator.active == True)
    return q.order_by(models.Operator.name).all()


@router.post("", response_model=schemas.OperatorOut, status_code=201)
def create_operator(payload: schemas.OperatorCreate, db: Session = Depends(get_db)):
    op = models.Operator(
        name=payload.name,
        phone=payload.phone,
        cedula=payload.cedula,
        commission_rate=payload.commission_rate,
        active=True,
    )
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


@router.patch("/{op_id}", response_model=schemas.OperatorOut)
def update_operator(op_id: int, payload: schemas.OperatorPatch, db: Session = Depends(get_db)):
    op = db.query(models.Operator).filter_by(id=op_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operario no encontrado")
    if payload.name is not None:
        op.name = payload.name
    if payload.phone is not None:
        op.phone = payload.phone
    if payload.cedula is not None:
        op.cedula = payload.cedula
    if payload.commission_rate is not None:
        op.commission_rate = payload.commission_rate
    if payload.active is not None:
        op.active = payload.active
    db.commit()
    db.refresh(op)
    return op
