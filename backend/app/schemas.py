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


class OperatorCreate(BaseModel):
    name:            str
    phone:           Optional[str] = None
    cedula:          Optional[str] = None
    commission_rate: Decimal = Decimal("0")


class OperatorPatch(BaseModel):
    name:            Optional[str]     = None
    phone:           Optional[str]     = None
    cedula:          Optional[str]     = None
    commission_rate: Optional[Decimal] = None
    active:          Optional[bool]    = None


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

class VehicleClientOut(OrmBase):
    name:  str
    phone: Optional[str]


class VehicleOut(OrmBase):
    id:        int
    type:      str
    brand:     Optional[str]
    model:     Optional[str]
    plate:     str
    color:     Optional[str]
    client_id: Optional[int]
    client:    Optional[VehicleClientOut] = None


class VehiclePatch(BaseModel):
    model: Optional[str] = None
    color: Optional[str] = None


# ── Order creation ───────────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    service_id: int


class ItemOverride(BaseModel):
    service_id: int
    unit_price: Decimal


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
    item_overrides:         list[ItemOverride]  = []
    scheduled_delivery_at:  Optional[datetime]  = None
    downpayment:            Optional[Decimal]   = None
    downpayment_method:     Optional[str]       = None
    is_warranty:            bool                = False

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
    paid:                bool
    downpayment:         Decimal
    is_warranty:         bool
    payment_cash:        Decimal
    payment_datafono:    Decimal
    payment_nequi:       Decimal
    payment_bancolombia: Decimal
    items:               list[OrderItemOut]


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
    scheduled_delivery_at: Optional[datetime]
    # Nested
    vehicle:  Optional[VehicleOut]
    order:    Optional[OrderOut]


class AdvancePayload(BaseModel):
    payment_cash:        Decimal = Decimal("0")
    payment_datafono:    Decimal = Decimal("0")
    payment_nequi:       Decimal = Decimal("0")
    payment_bancolombia: Decimal = Decimal("0")


class PatioPatch(BaseModel):
    color:                  Optional[str]      = None
    operator_id:            Optional[int]      = None
    notes:                  Optional[str]      = None
    service_ids:            Optional[list[int]]= None
    scheduled_delivery_at:  Optional[datetime] = None


# ── Ceramics ─────────────────────────────────────────────────────────────────

class CeramicClientOut(OrmBase):
    id:    int
    name:  str
    phone: Optional[str]
    email: Optional[str]


class CeramicVehicleOut(OrmBase):
    plate:  str
    brand:  Optional[str]
    model:  Optional[str]
    color:  Optional[str]
    type:   str
    client: Optional[CeramicClientOut]


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
    id:                  int
    order_number:        str
    date:                date
    status:              str
    total:               Optional[Decimal]
    vehicle:             Optional[HistorialVehicleOut]
    items:               List[HistorialItemOut]
    operator:            Optional[HistorialOperatorOut]
    payment_cash:        Optional[Decimal] = None
    payment_datafono:    Optional[Decimal] = None
    payment_nequi:       Optional[Decimal] = None
    payment_bancolombia: Optional[Decimal] = None


# ── Appointments ──────────────────────────────────────────────────────────────

class AppointmentOut(OrmBase):
    id:           int
    date:         date
    time:         Optional[str]
    vehicle_type: Optional[str]
    brand:        Optional[str]
    model:        Optional[str]
    plate:        Optional[str]
    client_name:  Optional[str]
    client_phone: Optional[str]
    comments:     Optional[str]
    status:       str
    order_id:     Optional[int]
    created_at:   datetime
    updated_at:   datetime


class AppointmentCreate(BaseModel):
    date:         date
    time:         Optional[str]  = None
    vehicle_type: Optional[str]  = None
    brand:        Optional[str]  = None
    model:        Optional[str]  = None
    plate:        Optional[str]  = None
    client_name:  str
    client_phone: Optional[str]  = None
    comments:     Optional[str]  = None


class AppointmentPatch(BaseModel):
    date:         Optional[str]  = None   # "YYYY-MM-DD" string; router converts to date
    time:         Optional[str]  = None
    vehicle_type: Optional[str]  = None
    brand:        Optional[str]  = None
    model:        Optional[str]  = None
    plate:        Optional[str]  = None
    client_name:  Optional[str]  = None
    client_phone: Optional[str]  = None
    comments:     Optional[str]  = None
    status:       Optional[str]  = None


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
    is_liquidated: bool


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
    unliquidated_count:       int
    liquidated_at:               Optional[str]
    net_amount:                  Optional[Decimal]
    payment_cash_amount:         Optional[Decimal]
    payment_datafono_amount:     Optional[Decimal]
    payment_nequi_amount:        Optional[Decimal]
    payment_bancolombia_amount:  Optional[Decimal]
    amount_pending:              Optional[Decimal]


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
    payment_cash:         Decimal = Decimal("0")
    payment_datafono:     Decimal = Decimal("0")
    payment_nequi:        Decimal = Decimal("0")
    payment_bancolombia:  Decimal = Decimal("0")


# ── Report ─────────────────────────────────────────────────────────────────────

class ReportOrderItem(BaseModel):
    service_name:     str
    service_category: str
    unit_price:       Decimal
    quantity:         int
    subtotal:         Decimal


class ReportOrder(BaseModel):
    order_number:  str
    date:          str
    vehicle_plate: str
    vehicle_brand: Optional[str]
    vehicle_model: Optional[str]
    items:         List[ReportOrderItem]
    total:         Decimal
    is_liquidated: bool


class ReportWeekStatus(BaseModel):
    week_start:           str
    week_end:             str
    is_liquidated:        bool
    week_gross:           Decimal
    week_commission:      Decimal
    net_amount:           Optional[Decimal] = None
    payment_cash:         Optional[Decimal] = None
    payment_datafono:     Optional[Decimal] = None
    payment_nequi:        Optional[Decimal] = None
    payment_bancolombia:  Optional[Decimal] = None
    amount_pending:       Optional[Decimal] = None


class ReportPendingDebt(BaseModel):
    description: Optional[str]
    amount:      Decimal
    paid_amount: Decimal
    remaining:   Decimal


class ReportResponse(BaseModel):
    operator_id:         int
    operator_name:       str
    commission_rate:     Decimal
    period_label:        str
    date_start:          str
    date_end:            str
    orders:              List[ReportOrder]
    total_services:      int
    gross_total:         Decimal
    commission_amount:   Decimal
    week_statuses:       List[ReportWeekStatus]
    pending_debts:       List[ReportPendingDebt]
    total_pending_owed:  Decimal


# ── Clients ─────────────────────────────────────────────────────────────────────

class ClientVehicleOut(OrmBase):
    id:    int
    plate: str
    brand: Optional[str]
    model: Optional[str]
    type:  str
    color: Optional[str]


class ClientOut(OrmBase):
    id:                   int
    name:                 str
    phone:                Optional[str]
    email:                Optional[str]
    tipo_persona:         Optional[str]
    tipo_identificacion:  Optional[str]
    identificacion:       Optional[str]
    dv:                   Optional[str]
    notes:                Optional[str]
    created_at:           datetime
    vehicles:             List[ClientVehicleOut] = []
    order_count:          int                    = 0
    total_spent:          Decimal                = Decimal("0")
    last_service:         Optional[date]         = None


class ClientPatch(BaseModel):
    name:                Optional[str] = None
    phone:               Optional[str] = None
    email:               Optional[str] = None
    tipo_persona:        Optional[str] = None
    tipo_identificacion: Optional[str] = None
    identificacion:      Optional[str] = None
    dv:                  Optional[str] = None
    notes:               Optional[str] = None


# ── Ingresos ────────────────────────────────────────────────────────────────────

class IngresosDayTotal(BaseModel):
    date:                str
    total:               Decimal
    payment_cash:        Decimal
    payment_datafono:    Decimal
    payment_nequi:       Decimal
    payment_bancolombia: Decimal

class IngresosResponse(BaseModel):
    date_start:          str
    date_end:            str
    total:               Decimal
    order_count:         int
    payment_cash:        Decimal
    payment_datafono:    Decimal
    payment_nequi:       Decimal
    payment_bancolombia: Decimal
    daily_totals:        List[IngresosDayTotal]


class IngresoBreakdownItem(BaseModel):
    order_number: str
    date:         str
    plate:        str
    vehicle:      str          # "brand model"
    client:       str
    amount:       float
    is_abono:     bool = False


# ── Expenses (Egresos) ──────────────────────────────────────────────────────────

class ExpenseOut(OrmBase):
    id:             int
    date:           date
    amount:         Decimal
    category:       Optional[str]
    description:    Optional[str]
    payment_method: Optional[str]
    notes:          Optional[str]
    created_at:     datetime


class ExpenseCreate(BaseModel):
    date:           date
    amount:         Decimal
    category:       Optional[str] = None
    description:    Optional[str] = None
    payment_method: Optional[str] = None
    notes:          Optional[str] = None
