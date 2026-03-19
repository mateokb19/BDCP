import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, Numeric, Date, DateTime,
    ForeignKey, SmallInteger, Text, Enum as SAEnum, func,
)
from sqlalchemy.orm import relationship
from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────────

class VehicleTypeEnum(str, enum.Enum):
    automovil       = "automovil"
    camion_estandar = "camion_estandar"
    camion_xl       = "camion_xl"

class ServiceCategoryEnum(str, enum.Enum):
    exterior = "exterior"
    interior = "interior"
    ceramico = "ceramico"

class OrderStatusEnum(str, enum.Enum):
    pendiente  = "pendiente"
    en_proceso = "en_proceso"
    listo      = "listo"
    entregado  = "entregado"
    cancelado  = "cancelado"

class PatioStatusEnum(str, enum.Enum):
    esperando  = "esperando"
    en_proceso = "en_proceso"
    listo      = "listo"
    entregado  = "entregado"

class AppointmentStatusEnum(str, enum.Enum):
    programada  = "programada"
    confirmada  = "confirmada"
    completada  = "completada"
    cancelada   = "cancelada"
    no_asistio  = "no_asistio"

class LiquidationStatusEnum(str, enum.Enum):
    pendiente = "pendiente"
    pagada    = "pagada"

class TransactionTypeEnum(str, enum.Enum):
    ingreso = "ingreso"
    egreso  = "egreso"


# native_enum=False makes every Enum column a plain VARCHAR,
# compatible with both SQLite (dev) and PostgreSQL (prod).
def _enum(py_enum, name):
    return SAEnum(py_enum, name=name, native_enum=False)


# ── Tables ─────────────────────────────────────────────────────────────────────

class Client(Base):
    __tablename__ = "clients"

    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False)
    phone      = Column(String(20))
    email      = Column(String(100))
    notes      = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    vehicles = relationship("Vehicle", back_populates="client")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id         = Column(Integer, primary_key=True)
    type       = Column(_enum(VehicleTypeEnum, "vehicle_type"), nullable=False)
    brand      = Column(String(50))
    model      = Column(String(100))
    plate      = Column(String(20), nullable=False, unique=True, index=True)
    color      = Column(String(50))
    client_id  = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    client        = relationship("Client", back_populates="vehicles")
    orders        = relationship("ServiceOrder", back_populates="vehicle")
    patio_entries = relationship("PatioEntry", back_populates="vehicle")


class Operator(Base):
    __tablename__ = "operators"

    id              = Column(Integer, primary_key=True)
    name            = Column(String(100), nullable=False)
    phone           = Column(String(20))
    commission_rate = Column(Numeric(5, 2), nullable=False, default=0)
    active          = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)

    orders = relationship("ServiceOrder", back_populates="operator")


class Service(Base):
    __tablename__ = "services"

    id                    = Column(Integer, primary_key=True)
    category              = Column(_enum(ServiceCategoryEnum, "service_category"), nullable=False)
    name                  = Column(String(100), nullable=False)
    description           = Column(Text)
    price_automovil       = Column(Numeric(10, 2), nullable=False)
    price_camion_estandar = Column(Numeric(10, 2))
    price_camion_xl       = Column(Numeric(10, 2))
    active                = Column(Boolean, nullable=False, default=True)
    created_at            = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at            = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ServiceOrder(Base):
    __tablename__ = "service_orders"

    id             = Column(Integer, primary_key=True)
    order_number   = Column(String(20), unique=True)
    date           = Column(Date, nullable=False, server_default=func.current_date())
    vehicle_id     = Column(Integer, ForeignKey("vehicles.id"), nullable=False, index=True)
    operator_id    = Column(Integer, ForeignKey("operators.id", ondelete="SET NULL"), index=True)
    status         = Column(_enum(OrderStatusEnum, "order_status"), nullable=False, default=OrderStatusEnum.pendiente)
    subtotal       = Column(Numeric(10, 2), nullable=False, default=0)
    discount       = Column(Numeric(10, 2), nullable=False, default=0)
    total          = Column(Numeric(10, 2), nullable=False, default=0)
    paid           = Column(Boolean, nullable=False, default=False)
    payment_method = Column(String(50))
    notes          = Column(Text)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"))
    created_at     = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    vehicle     = relationship("Vehicle", back_populates="orders")
    operator    = relationship("Operator", back_populates="orders")
    items       = relationship("ServiceOrderItem", back_populates="order", cascade="all, delete-orphan")
    patio_entry = relationship("PatioEntry", back_populates="order", uselist=False)


class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"

    id               = Column(Integer, primary_key=True)
    order_id         = Column(Integer, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id       = Column(Integer, ForeignKey("services.id", ondelete="SET NULL"))
    service_name     = Column(String(100), nullable=False)
    service_category = Column(_enum(ServiceCategoryEnum, "service_category"), nullable=False)
    unit_price       = Column(Numeric(10, 2), nullable=False)
    quantity         = Column(Integer, nullable=False, default=1)
    subtotal         = Column(Numeric(10, 2), nullable=False)

    order = relationship("ServiceOrder", back_populates="items")


class PatioEntry(Base):
    __tablename__ = "patio"

    id           = Column(Integer, primary_key=True)
    order_id     = Column(Integer, ForeignKey("service_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id   = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    position     = Column(SmallInteger)
    status       = Column(_enum(PatioStatusEnum, "patio_status"), nullable=False, default=PatioStatusEnum.esperando)
    entered_at   = Column(DateTime, server_default=func.now(), nullable=False)
    started_at   = Column(DateTime)
    completed_at = Column(DateTime)
    delivered_at = Column(DateTime)
    notes        = Column(Text)

    order   = relationship("ServiceOrder", back_populates="patio_entry")
    vehicle = relationship("Vehicle", back_populates="patio_entries")


class Appointment(Base):
    __tablename__ = "appointments"

    id           = Column(Integer, primary_key=True)
    date         = Column(Date, nullable=False)
    time         = Column(String(5))
    vehicle_type = Column(_enum(VehicleTypeEnum, "vehicle_type"))
    brand        = Column(String(50))
    model        = Column(String(100))
    plate        = Column(String(20))
    client_id    = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"))
    client_name  = Column(String(100))
    client_phone = Column(String(20))
    comments     = Column(Text)
    status       = Column(_enum(AppointmentStatusEnum, "appointment_status"), nullable=False, default=AppointmentStatusEnum.programada)
    order_id     = Column(Integer, ForeignKey("service_orders.id", ondelete="SET NULL"))
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
