import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, Numeric, Date, DateTime,
    ForeignKey, SmallInteger, Text, Enum as SAEnum, func, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────────

class VehicleTypeEnum(str, enum.Enum):
    automovil       = "automovil"
    camion_estandar = "camion_estandar"
    camion_xl       = "camion_xl"
    moto            = "moto"

class ServiceCategoryEnum(str, enum.Enum):
    exterior            = "exterior"
    interior            = "interior"
    ceramico            = "ceramico"
    correccion_pintura  = "correccion_pintura"
    latoneria           = "latoneria"
    pintura             = "pintura"
    ppf                 = "ppf"
    polarizado          = "polarizado"
    otro                = "otro"

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
    email             = Column(String(100))
    tipo_persona      = Column(String(20))
    tipo_identificacion = Column(String(50))
    identificacion    = Column(String(30))
    dv                = Column(String(2))
    notes             = Column(Text)
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
    cedula          = Column(String(20))
    commission_rate = Column(Numeric(5, 2), nullable=False, default=0)
    operator_type   = Column(String(30), nullable=False, server_default='detallado')
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
    price_moto            = Column(Numeric(10, 2))
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
    paid             = Column(Boolean, nullable=False, default=False)
    payment_method   = Column(String(50))
    payment_cash        = Column(Numeric(12, 2), nullable=False, default=0)
    payment_datafono    = Column(Numeric(12, 2), nullable=False, default=0)
    payment_nequi       = Column(Numeric(12, 2), nullable=False, default=0)
    payment_bancolombia = Column(Numeric(12, 2), nullable=False, default=0)
    notes            = Column(Text)
    is_client_credit        = Column(Boolean, nullable=False, default=False)
    client_credit_paid_at   = Column(DateTime, nullable=True)
    downpayment        = Column(Numeric(12, 2), nullable=False, default=0)
    downpayment_method = Column(String(50))
    is_warranty        = Column(Boolean, nullable=False, default=False)
    latoneria_operator_pay    = Column(Numeric(12, 2), nullable=True)
    latoneria_liquidation_id  = Column(Integer, ForeignKey("week_liquidations.id", ondelete="SET NULL"), nullable=True)
    pintura_liquidation_id    = Column(Integer, ForeignKey("week_liquidations.id", ondelete="SET NULL"), nullable=True)
    appointment_id       = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"))
    week_liquidation_id  = Column(Integer, ForeignKey("week_liquidations.id", ondelete="SET NULL"), nullable=True)
    created_at           = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

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
    unit_price              = Column(Numeric(10, 2), nullable=False)
    standard_price          = Column(Numeric(10, 2))
    is_confirmed            = Column(Boolean, nullable=False, default=False)
    quantity                = Column(Integer, nullable=False, default=1)
    subtotal                = Column(Numeric(10, 2), nullable=False)
    latoneria_operator_pay  = Column(Numeric(12, 2), nullable=True)

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
    scheduled_delivery_at = Column(DateTime)

    order   = relationship("ServiceOrder", back_populates="patio_entry")
    vehicle = relationship("Vehicle", back_populates="patio_entries")


class CeramicTreatment(Base):
    __tablename__ = "ceramic_treatments"

    id               = Column(Integer, primary_key=True)
    order_id         = Column(Integer, ForeignKey("service_orders.id", ondelete="SET NULL"))
    vehicle_id       = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    service_id       = Column(Integer, ForeignKey("services.id", ondelete="SET NULL"))
    treatment_type   = Column(String(100), nullable=False)
    operator_id      = Column(Integer, ForeignKey("operators.id", ondelete="SET NULL"))
    application_date = Column(Date, nullable=False, server_default=func.current_date())
    next_maintenance = Column(Date)
    notes            = Column(Text)
    created_at       = Column(DateTime, server_default=func.now(), nullable=False)

    vehicle  = relationship("Vehicle")
    operator = relationship("Operator")


class DebtDirectionEnum(str, enum.Enum):
    empresa_operario = "empresa_operario"
    operario_empresa = "operario_empresa"


class Debt(Base):
    __tablename__ = "debts"

    id                  = Column(Integer, primary_key=True)
    operator_id         = Column(Integer, ForeignKey("operators.id", ondelete="CASCADE"), nullable=False, index=True)
    direction           = Column(_enum(DebtDirectionEnum, "debt_direction"), nullable=False)
    amount              = Column(Numeric(12, 2), nullable=False)
    description         = Column(String(200))
    paid                = Column(Boolean, nullable=False, default=False)
    paid_amount         = Column(Numeric(12, 2), nullable=False, default=0)
    created_at          = Column(DateTime, server_default=func.now(), nullable=False)
    week_liquidation_id = Column(Integer, ForeignKey("week_liquidations.id", ondelete="SET NULL"), nullable=True)

    operator = relationship("Operator")
    payments = relationship("DebtPayment", back_populates="debt", cascade="all, delete-orphan")


class DebtPayment(Base):
    __tablename__ = "debt_payments"

    id             = Column(Integer, primary_key=True)
    debt_id        = Column(Integer, ForeignKey("debts.id", ondelete="CASCADE"), nullable=False, index=True)
    liquidation_id = Column(Integer, ForeignKey("week_liquidations.id", ondelete="SET NULL"), nullable=True)
    amount         = Column(Numeric(12, 2), nullable=False)
    notes          = Column(String(200))
    created_at     = Column(DateTime, server_default=func.now(), nullable=False)

    debt = relationship("Debt", back_populates="payments")


class WeekLiquidation(Base):
    __tablename__ = "week_liquidations"

    id                = Column(Integer, primary_key=True)
    operator_id       = Column(Integer, ForeignKey("operators.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start        = Column(Date, nullable=False)
    total_amount      = Column(Numeric(12, 2), nullable=False, default=0)
    commission_amount = Column(Numeric(12, 2), nullable=False, default=0)
    net_amount        = Column(Numeric(12, 2), nullable=False, default=0)
    payment_cash         = Column(Numeric(12, 2), nullable=False, default=0)
    payment_datafono     = Column(Numeric(12, 2), nullable=False, default=0)
    payment_nequi        = Column(Numeric(12, 2), nullable=False, default=0)
    payment_bancolombia  = Column(Numeric(12, 2), nullable=False, default=0)
    amount_pending       = Column(Numeric(12, 2), nullable=False, default=0)
    liquidated_at     = Column(DateTime, server_default=func.now(), nullable=False)

    operator = relationship("Operator")

    __table_args__ = (UniqueConstraint("operator_id", "week_start", name="uq_week_liquidation"),)


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


class Expense(Base):
    __tablename__ = "expenses"

    id             = Column(Integer, primary_key=True)
    date           = Column(Date, nullable=False, server_default=func.current_date())
    amount         = Column(Numeric(12, 2), nullable=False)
    category       = Column(String(100))
    description    = Column(String(300))
    payment_method = Column(String(50))
    notes          = Column(Text)
    created_at     = Column(DateTime, server_default=func.now(), nullable=False)
