import re
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, field_validator, model_validator


# ── Shared ──────────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = {"from_attributes": True}


# ── Operator ────────────────────────────────────────────────────────────────────

class OperatorOut(OrmBase):
    id:              int
    name:            str
    phone:           Optional[str]
    cedula:          Optional[str]
    commission_rate: Decimal
    active:          bool


# ── Service ─────────────────────────────────────────────────────────────────────

class ServiceOut(OrmBase):
    id:                    int
    category:              str
    name:                  str
    description:           Optional[str]
    price_automovil:       Decimal
    price_camion_estandar: Optional[Decimal]
    price_camion_xl:       Optional[Decimal]
    active:                bool


# ── Vehicle ──────────────────────────────────────────────────────────────────────

class VehicleOut(OrmBase):
    id:        int
    type:      str
    brand:     Optional[str]
    model:     Optional[str]
    plate:     str
    color:     Optional[str]
    client_id: Optional[int]


class VehiclePatch(BaseModel):
    model: Optional[str] = None
    color: Optional[str] = None


# ── Order creation ───────────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    service_id: int


class OrderCreate(BaseModel):
    # Vehicle fields
    vehicle_type: str
    plate:        str
    brand:        str
    model:        Optional[str] = None
    color:        Optional[str] = None
    # Client fields
    client_name:  str
    client_phone: str
    # Order fields
    operator_id:  Optional[int] = None
    service_ids:  list[int]
    notes:        Optional[str] = None

    @field_validator("plate")
    @classmethod
    def validate_plate(cls, v: str) -> str:
        v = v.upper().strip()
        if not v:
            raise ValueError("La placa es obligatoria")
        if len(v) > 6:
            raise ValueError("La placa no puede tener más de 6 caracteres")
        if not re.fullmatch(r"[A-Z0-9]{1,6}", v):
            raise ValueError("La placa solo puede contener letras y números")
        return v

    @field_validator("brand")
    @classmethod
    def validate_brand(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La marca es obligatoria")
        return v

    @field_validator("client_name")
    @classmethod
    def validate_client_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre del cliente es obligatorio")
        return v

    @field_validator("client_phone")
    @classmethod
    def validate_client_phone(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El teléfono del cliente es obligatorio")
        return v

    @model_validator(mode="after")
    def validate_services(self) -> "OrderCreate":
        if not self.service_ids:
            raise ValueError("Debe seleccionar al menos un servicio")
        return self


class OrderItemOut(OrmBase):
    id:               int
    service_id:       Optional[int]
    service_name:     str
    service_category: str
    unit_price:       Decimal
    quantity:         int
    subtotal:         Decimal


class OrderOut(OrmBase):
    id:           int
    order_number: str
    date:         date
    vehicle_id:   int
    operator_id:  Optional[int]
    status:       str
    subtotal:     Decimal
    total:        Decimal
    paid:         bool
    items:        list[OrderItemOut]


# ── Patio ────────────────────────────────────────────────────────────────────────

class PatioEntryOut(OrmBase):
    id:           int
    order_id:     int
    vehicle_id:   int
    position:     Optional[int]
    status:       str
    entered_at:   datetime
    started_at:   Optional[datetime]
    completed_at: Optional[datetime]
    delivered_at: Optional[datetime]
    notes:        Optional[str]
    # Nested
    vehicle:  Optional[VehicleOut]
    order:    Optional[OrderOut]


class PatioPatch(BaseModel):
    color:       Optional[str] = None
    operator_id: Optional[int] = None
    notes:       Optional[str] = None
    service_ids: Optional[list[int]] = None


# ── Ceramics ─────────────────────────────────────────────────────────────────

class CeramicVehicleOut(OrmBase):
    plate: str
    brand: Optional[str]
    model: Optional[str]
    color: Optional[str]
    type:  str


class CeramicOperatorOut(OrmBase):
    id:   int
    name: str


class CeramicTreatmentOut(OrmBase):
    id:               int
    order_id:         Optional[int]
    vehicle_id:       int
    service_id:       Optional[int]
    treatment_type:   str
    operator_id:      Optional[int]
    application_date: date
    next_maintenance: Optional[date]
    notes:            Optional[str]
    created_at:       datetime
    vehicle:          Optional[CeramicVehicleOut]
    operator:         Optional[CeramicOperatorOut]


# ── Historial ─────────────────────────────────────────────────────────────────

class HistorialClientOut(OrmBase):
    name:  str
    phone: Optional[str]


class HistorialVehicleOut(OrmBase):
    plate: str
    brand: Optional[str]
    model: Optional[str]
    color: Optional[str]
    type:  str
    client: Optional[HistorialClientOut]


class HistorialOperatorOut(OrmBase):
    id:   int
    name: str


class HistorialItemOut(OrmBase):
    service_name:     str
    service_category: str
    unit_price:       Decimal
    quantity:         int
    subtotal:         Decimal


class HistorialEntryOut(OrmBase):
    id:           int
    order_number: str
    date:         date
    status:       str
    total:        Optional[Decimal]
    vehicle:      Optional[HistorialVehicleOut]
    items:        List[HistorialItemOut]
    operator:     Optional[HistorialOperatorOut]


# ── Liquidation ───────────────────────────────────────────────────────────────

class LiqWeekOrderItem(BaseModel):
    service_name: str
    unit_price:   Decimal
    quantity:     int
    subtotal:     Decimal


class LiqWeekOrder(BaseModel):
    order_id:      int
    order_number:  str
    patio_status:  str
    vehicle_plate: str
    vehicle_brand: Optional[str]
    vehicle_model: Optional[str]
    items:         List[LiqWeekOrderItem]
    total:         Decimal


class LiqWeekDay(BaseModel):
    date:         str
    day_name:     str
    orders:       List[LiqWeekOrder]
    day_total:    Decimal
    day_services: int


class LiqWeekResponse(BaseModel):
    operator_id:              int
    operator_name:            str
    commission_rate:          Decimal
    week_start:               str
    week_end:                 str
    days:                     List[LiqWeekDay]
    week_total:               Decimal
    week_services:            int
    commission_amount:        Decimal
    is_liquidated:            bool
    liquidated_at:            Optional[str]
    net_amount:               Optional[Decimal]
    payment_transfer_amount:  Optional[Decimal]
    payment_cash_amount:      Optional[Decimal]
    amount_pending:           Optional[Decimal]


class DebtPaymentOut(OrmBase):
    id:         int
    debt_id:    int
    amount:     Decimal
    notes:      Optional[str]
    created_at: datetime


class DebtOut(OrmBase):
    id:          int
    operator_id: int
    direction:   str
    amount:      Decimal
    paid_amount: Decimal
    description: Optional[str]
    paid:        bool
    created_at:  datetime
    payments:    List["DebtPaymentOut"] = []


class DebtCreate(BaseModel):
    direction:   str
    amount:      Decimal
    description: Optional[str] = None


class AbonoItem(BaseModel):
    debt_id: int
    amount:  Decimal


class LiquidatePayload(BaseModel):
    abonos:               List[AbonoItem] = []
    company_settlements:  List[AbonoItem] = []
    payment_transfer:     Decimal = Decimal("0")
    payment_cash:         Decimal = Decimal("0")
