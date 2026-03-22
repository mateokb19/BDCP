from datetime import date as _date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/egresos", tags=["egresos"])


@router.get("", response_model=list[schemas.ExpenseOut])
def list_expenses(
    date_start: str | None = None,
    date_end:   str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Expense)
    if date_start:
        try:
            q = q.filter(models.Expense.date >= _date.fromisoformat(date_start))
        except ValueError:
            pass
    if date_end:
        try:
            q = q.filter(models.Expense.date <= _date.fromisoformat(date_end))
        except ValueError:
            pass
    return q.order_by(models.Expense.date.desc(), models.Expense.id.desc()).all()


@router.post("", response_model=schemas.ExpenseOut, status_code=201)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    expense = models.Expense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{id}", status_code=204)
def delete_expense(id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    db.delete(expense)
    db.commit()
