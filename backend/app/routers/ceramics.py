from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/ceramics", tags=["ceramics"])


@router.get("", response_model=list[schemas.CeramicTreatmentOut])
def list_ceramics(db: Session = Depends(get_db)):
    ceramics = (
        db.query(models.CeramicTreatment)
        .options(
            joinedload(models.CeramicTreatment.vehicle).joinedload(models.Vehicle.client),
            joinedload(models.CeramicTreatment.operator),
        )
        .order_by(models.CeramicTreatment.application_date.desc())
        .all()
    )

    # Fetch all Mantenimiento Cerámico order dates per vehicle in one query
    vehicle_ids = list({c.vehicle_id for c in ceramics})
    maint_rows = (
        db.query(
            models.ServiceOrder.vehicle_id,
            models.ServiceOrder.date,
        )
        .join(models.ServiceOrderItem, models.ServiceOrderItem.order_id == models.ServiceOrder.id)
        .join(models.Service, models.Service.id == models.ServiceOrderItem.service_id)
        .filter(
            models.ServiceOrder.vehicle_id.in_(vehicle_ids),
            models.Service.name == "Mantenimiento Cerámico",
            models.ServiceOrder.status == models.OrderStatusEnum.entregado,
        )
        .distinct()
        .all()
    )

    maint_by_vehicle: dict[int, list] = defaultdict(list)
    for row in maint_rows:
        maint_by_vehicle[row.vehicle_id].append(row.date)

    for c in ceramics:
        c.maintenance_dates = sorted(maint_by_vehicle.get(c.vehicle_id, []))

    return ceramics
