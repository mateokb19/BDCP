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
    model:       Optional[str] = None
    color:       Optional[str] = None
    operator_id: Optional[int] = None
    notes:       Optional[str] = None


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
