from datetime import date
from typing import Optional
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("", response_model=list[schemas.AppointmentOut])
def list_appointments(month: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """List appointments. If month=YYYY-MM, returns only that month."""
    q = db.query(models.Appointment)
    if month:
        year, mon = int(month[:4]), int(month[5:7])
        ds = date(year, mon, 1)
        de = date(year, mon, monthrange(year, mon)[1])
        q = q.filter(models.Appointment.date >= ds, models.Appointment.date <= de)
    return q.order_by(models.Appointment.date, models.Appointment.time).all()


@router.post("", response_model=schemas.AppointmentOut, status_code=201)
def create_appointment(body: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    appt = models.Appointment(**body.model_dump())
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


@router.patch("/{appt_id}", response_model=schemas.AppointmentOut)
def patch_appointment(appt_id: int, body: schemas.AppointmentPatch, db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter_by(id=appt_id).first()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(appt, field, value)
    db.commit()
    db.refresh(appt)
    return appt


@router.delete("/{appt_id}", status_code=204)
def delete_appointment(appt_id: int, db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter_by(id=appt_id).first()
    if not appt:
        raise HTTPException(404, "Cita no encontrada")
    db.delete(appt)
    db.commit()
