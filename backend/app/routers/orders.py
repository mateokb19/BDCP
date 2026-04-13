import calendar
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.tz import today_bogota


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)

router = APIRouter(prefix="/orders", tags=["orders"])


def _get_service_price(service: models.Service, vehicle_type: str) -> Decimal:
    """Return the client-facing price for the given vehicle type."""
    if vehicle_type == "moto" and service.price_moto is not None:
        return service.price_moto
    if vehicle_type == "camion_estandar" and service.price_camion_estandar is not None:
        return service.price_camion_estandar
    if vehicle_type == "camion_xl" and service.price_camion_xl is not None:
        return service.price_camion_xl
    return service.price_automovil


def _next_order_number(db: Session) -> str:
    year = date.today().year
    prefix = f"ORD-{year}-"
    # Find the highest sequence number already used this year
    last = (
        db.query(func.max(models.ServiceOrder.order_number))
        .filter(models.ServiceOrder.order_number.like(f"{prefix}%"))
        .scalar()
    )
    if last:
        try:
            seq = int(last.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{prefix}{str(seq).zfill(4)}"


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

    # 3b. Reject if vehicle already has an active (non-delivered) patio entry
    active_patio = db.query(models.PatioEntry).filter(
        models.PatioEntry.vehicle_id == vehicle.id,
        models.PatioEntry.status != models.PatioStatusEnum.entregado,
    ).first()
    if active_patio:
        raise HTTPException(
            status_code=409,
            detail=f"El vehículo {vehicle.plate} ya tiene un servicio activo en el patio (estado: {active_patio.status.value}). Debe ser entregado antes de ingresar uno nuevo.",
        )

    # 4. Build order items with price snapshot (overrides supported)
    override_map = {ov.service_id: ov for ov in payload.item_overrides}
    lat_pay_map  = {lp.service_id: lp.amount for lp in payload.latoneria_operator_pays}
    subtotal = Decimal("0.00")
    discount = Decimal("0.00")
    item_rows = []
    for svc in services:
        ov           = override_map.get(svc.id)
        display_std  = _get_service_price(svc, payload.vehicle_type)
        price        = ov.unit_price if ov else display_std
        name         = (ov.custom_name or svc.name) if ov else svc.name
        # For motos, standard_price (commission base) = automovil price, not moto price.
        # standard_price_override (e.g. parcial pintura) takes highest priority.
        if ov and ov.standard_price_override is not None:
            std_price = ov.standard_price_override
        elif payload.vehicle_type == "moto":
            std_price = svc.price_automovil
        else:
            std_price = display_std
        if price < display_std:
            discount += display_std - price
        item_rows.append(models.ServiceOrderItem(
            service_id=svc.id,
            service_name=name,
            service_category=svc.category,
            unit_price=price,
            standard_price=std_price,
            quantity=1,
            subtotal=price,
            latoneria_operator_pay=lat_pay_map.get(svc.id),
        ))
        subtotal += price

    # Sum per-item latonería pay → order-level total
    total_lat_pay = sum(lat_pay_map.values()) or None

    # 5. Create service order (date set explicitly in Bogota timezone, or overridden by entry_date)
    order = models.ServiceOrder(
        order_number=_next_order_number(db),
        date=payload.entry_date or today_bogota(),
        vehicle_id=vehicle.id,
        operator_id=payload.operator_id,
        status=models.OrderStatusEnum.pendiente,
        subtotal=subtotal,
        discount=discount,
        total=subtotal,            # full amount (before abono; abono is separate field)
        paid=False,
        downpayment=payload.downpayment or Decimal("0.00"),
        downpayment_method=payload.downpayment_method,
        is_warranty=payload.is_warranty,
        notes=payload.notes,
        latoneria_operator_pay=total_lat_pay,
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
        scheduled_delivery_at=payload.scheduled_delivery_at,
    )
    db.add(patio)

    # 7. Create ceramic treatment records for every ceramic service
    today = today_bogota()
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
