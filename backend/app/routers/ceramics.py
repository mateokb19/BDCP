from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/ceramics", tags=["ceramics"])


@router.get("", response_model=list[schemas.CeramicTreatmentOut])
def list_ceramics(db: Session = Depends(get_db)):
    return (
        db.query(models.CeramicTreatment)
        .options(
            joinedload(models.CeramicTreatment.vehicle).joinedload(models.Vehicle.client),
            joinedload(models.CeramicTreatment.operator),
        )
        .order_by(models.CeramicTreatment.application_date.desc())
        .all()
    )
