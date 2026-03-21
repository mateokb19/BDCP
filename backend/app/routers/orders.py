import calendar
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)

router = APIRouter(prefix="/orders", tags=["orders"])


def _get_service_price(service: models.Service, vehicle_type: str) -> Decimal:
    if vehicle_type == "camion_estandar" and service.price_camion_estandar is not None:
        return service.price_camion_estandar
    if vehicle_type == "camion_xl" and service.price_camion_xl is not None:
        return service.price_camion_xl
    return service.price_automovil


def _next_order_number(db: Session) -> str:
    count = db.query(models.ServiceOrder).count()
    return f"ORD-{date.today().year}-{str(count + 1).zfill(4)}"


@router.post("", response_model=schemas.OrderOut, status_code=201)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    # 1. Validate services exist
    services = db.query(models.Service).filter(
        models.Service.id.in_(payload.service_ids),
        models.Service.active == True,
    ).all()
    if len(services) != len(payload.service_ids):
        raise HTTPException(status_code=422, detail="Uno o más servicios no son válidos")

    # 2. Find or create client by phone
    client = db.query(models.Client).filter(
        models.Client.phone == payload.client_phone
    ).first()
    if not client:
        client = models.Client(name=payload.client_name, phone=payload.client_phone)
        db.add(client)
        db.flush()

    # 3. Find or create vehicle by plate
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.plate == payload.plate
    ).first()
    if vehicle:
        # Update mutable fields if provided
        if payload.brand:  vehicle.brand = payload.brand
        if payload.model:  vehicle.model = payload.model
        if payload.color:  vehicle.color = payload.color
        if not vehicle.client_id:
            vehicle.client_id = client.id
    else:
        vehicle = models.Vehicle(
            type=payload.vehicle_type,
            plate=payload.plate,
            brand=payload.brand,
            model=payload.model,
            color=payload.color,
            client_id=client.id,
        )
        db.add(vehicle)
        db.flush()

    # 4. Build order items with price snapshot
    total = Decimal("0.00")
    item_rows = []
    for svc in services:
        price = _get_service_price(svc, payload.vehicle_type)
        item_rows.append(models.ServiceOrderItem(
            service_id=svc.id,
            service_name=svc.name,
            service_category=svc.category,
            unit_price=price,
            quantity=1,
            subtotal=price,
        ))
        total += price

    # 5. Create service order
    order = models.ServiceOrder(
        order_number=_next_order_number(db),
        vehicle_id=vehicle.id,
        operator_id=payload.operator_id,
        status=models.OrderStatusEnum.pendiente,
        subtotal=total,
        discount=Decimal("0.00"),
        total=total,
        paid=False,
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    for item in item_rows:
        item.order_id = order.id
        db.add(item)

    # 6. Create patio entry in "esperando"
    patio = models.PatioEntry(
        order_id=order.id,
        vehicle_id=vehicle.id,
        status=models.PatioStatusEnum.esperando,
    )
    db.add(patio)

    # 7. Create ceramic treatment records for every ceramic service
    today = date.today()
    for svc in services:
        if svc.category == "ceramico":
            db.add(models.CeramicTreatment(
                order_id=order.id,
                vehicle_id=vehicle.id,
                service_id=svc.id,
                treatment_type=svc.name,
                operator_id=payload.operator_id,
                application_date=today,
                next_maintenance=_add_months(today, 6),
            ))

    db.commit()
    db.refresh(order)
    return order
