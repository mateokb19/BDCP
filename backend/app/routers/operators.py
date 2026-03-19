from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/operators", tags=["operators"])


@router.get("", response_model=list[schemas.OperatorOut])
def list_operators(db: Session = Depends(get_db)):
    return db.query(models.Operator).filter(models.Operator.active == True).all()
