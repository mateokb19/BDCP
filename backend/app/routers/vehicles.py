from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("/by-plate/{plate}", response_model=schemas.VehicleOut)
def get_vehicle_by_plate(plate: str, db: Session = Depends(get_db)):
    """Look up a vehicle by plate to pre-fill the order form."""
    normalized = plate.upper().replace("-", "").strip()
    vehicle = (
        db.query(models.Vehicle)
        .filter(models.Vehicle.plate == normalized)
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return vehicle
