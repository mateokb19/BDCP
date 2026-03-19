-- ============================================================
-- BDCPolo - Schema de Base de Datos PostgreSQL
-- ============================================================

-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE vehicle_type AS ENUM (
    'automovil',
    'camion_estandar',
    'camion_xl'
);

CREATE TYPE service_category AS ENUM (
    'exterior',
    'interior',
    'ceramico'
);

CREATE TYPE order_status AS ENUM (
    'pendiente',
    'en_proceso',
    'listo',
    'entregado',
    'cancelado'
);

CREATE TYPE patio_status AS ENUM (
    'esperando',
    'en_proceso',
    'listo',
    'entregado'
);

CREATE TYPE appointment_status AS ENUM (
    'programada',
    'confirmada',
    'completada',
    'cancelada',
    'no_asistio'
);

CREATE TYPE transaction_type AS ENUM (
    'ingreso',
    'egreso'
);

CREATE TYPE liquidation_status AS ENUM (
    'pendiente',
    'pagada'
);

CREATE TYPE user_role AS ENUM (
    'admin',
    'recepcion',
    'operario'
);

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE clients (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20),
    email       VARCHAR(100),
    notes       TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VEHÍCULOS
-- Puede existir sin cliente registrado (cliente de paso).
-- La placa es el identificador único del vehículo.
-- ============================================================

CREATE TABLE vehicles (
    id          SERIAL PRIMARY KEY,
    type        vehicle_type NOT NULL,
    brand       VARCHAR(50),
    model       VARCHAR(100),
    plate       VARCHAR(20) NOT NULL UNIQUE,
    color       VARCHAR(50),
    client_id   INT REFERENCES clients(id) ON DELETE SET NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicles_plate     ON vehicles(plate);
CREATE INDEX idx_vehicles_client_id ON vehicles(client_id);

-- ============================================================
-- OPERARIOS
-- ============================================================

CREATE TABLE operators (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    phone            VARCHAR(20),
    commission_rate  DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- porcentaje (0-100)
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CATÁLOGO DE SERVICIOS
-- ============================================================

CREATE TABLE services (
    id                      SERIAL PRIMARY KEY,
    category                service_category NOT NULL,
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    -- Precios diferenciados por tipo de vehículo
    price_automovil         DECIMAL(10, 2) NOT NULL,
    price_camion_estandar   DECIMAL(10, 2),
    price_camion_xl         DECIMAL(10, 2),
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÓRDENES DE SERVICIO
-- Creadas desde "Ingresar Servicio" o al confirmar una cita.
-- ============================================================

CREATE TABLE service_orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(20) UNIQUE,       -- e.g. ORD-2026-0001 (generado en app)
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id      INT NOT NULL REFERENCES vehicles(id),
    operator_id     INT REFERENCES operators(id) ON DELETE SET NULL,
    status          order_status NOT NULL DEFAULT 'pendiente',
    subtotal        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discount        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    paid            BOOLEAN NOT NULL DEFAULT FALSE,
    payment_method  VARCHAR(50),              -- 'efectivo', 'transferencia', 'tarjeta'
    notes           TEXT,
    appointment_id  INT,                      -- FK a appointments, se completa si viene de cita
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_date        ON service_orders(date);
CREATE INDEX idx_orders_vehicle_id  ON service_orders(vehicle_id);
CREATE INDEX idx_orders_operator_id ON service_orders(operator_id);
CREATE INDEX idx_orders_status      ON service_orders(status);

-- ============================================================
-- ÍTEMS DE ORDEN DE SERVICIO
-- Se guarda el nombre y precio en el momento de la orden
-- (snapshot) para que cambios futuros en el catálogo no afecten
-- registros históricos.
-- ============================================================

CREATE TABLE service_order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    service_id      INT REFERENCES services(id) ON DELETE SET NULL,
    service_name    VARCHAR(100) NOT NULL,    -- snapshot
    service_category service_category NOT NULL, -- snapshot
    unit_price      DECIMAL(10, 2) NOT NULL,  -- snapshot
    quantity        INT NOT NULL DEFAULT 1,
    subtotal        DECIMAL(10, 2) NOT NULL   -- unit_price * quantity
);

CREATE INDEX idx_order_items_order_id ON service_order_items(order_id);

-- ============================================================
-- CITAS / CALENDARIO
-- Una cita puede convertirse en orden de servicio.
-- Se permite registrar datos del vehículo manualmente (sin
-- que el vehículo esté en la tabla vehicles todavía).
-- ============================================================

CREATE TABLE appointments (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    time            TIME,
    vehicle_type    vehicle_type,
    brand           VARCHAR(50),
    model           VARCHAR(100),
    plate           VARCHAR(20),
    client_id       INT REFERENCES clients(id) ON DELETE SET NULL,
    client_name     VARCHAR(100),             -- si no está registrado como cliente
    client_phone    VARCHAR(20),
    comments        TEXT,
    status          appointment_status NOT NULL DEFAULT 'programada',
    order_id        INT REFERENCES service_orders(id) ON DELETE SET NULL, -- si ya se atendió
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointments_date   ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Servicios solicitados en la cita (relación N:M con el catálogo)
CREATE TABLE appointment_services (
    id              SERIAL PRIMARY KEY,
    appointment_id  INT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id      INT REFERENCES services(id) ON DELETE SET NULL,
    service_name    VARCHAR(100) NOT NULL     -- permite servicios ad-hoc sin ID de catálogo
);

-- ============================================================
-- ESTADO DE PATIO
-- Registro de qué vehículos están físicamente en el patio,
-- su posición y en qué estado está el trabajo.
-- ============================================================

CREATE TABLE patio (
    id              SERIAL PRIMARY KEY,
    order_id        INT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    vehicle_id      INT NOT NULL REFERENCES vehicles(id),
    position        SMALLINT,                 -- puesto o slot en el patio
    status          patio_status NOT NULL DEFAULT 'esperando',
    entered_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    delivered_at    TIMESTAMP,
    notes           TEXT
);

CREATE INDEX idx_patio_status   ON patio(status);
CREATE INDEX idx_patio_order_id ON patio(order_id);

-- ============================================================
-- INVENTARIO
-- ============================================================

CREATE TABLE inventory_categories (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL
);

CREATE TABLE inventory_items (
    id              SERIAL PRIMARY KEY,
    category_id     INT REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    quantity        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    unit            VARCHAR(20) NOT NULL,     -- 'litros', 'unidades', 'kg', 'ml'
    min_stock       DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- umbral de alerta
    cost_per_unit   DECIMAL(10, 2),
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Movimientos de inventario (entradas y salidas con trazabilidad)
CREATE TABLE inventory_movements (
    id          SERIAL PRIMARY KEY,
    item_id     INT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('entrada', 'salida')),
    quantity    DECIMAL(10, 2) NOT NULL,
    reason      TEXT,
    order_id    INT REFERENCES service_orders(id) ON DELETE SET NULL, -- si fue consumo en una orden
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_movements_item_id ON inventory_movements(item_id);

-- ============================================================
-- CERÁMICOS
-- Seguimiento de tratamientos cerámicos con garantía.
-- ============================================================

CREATE TABLE ceramic_treatments (
    id               SERIAL PRIMARY KEY,
    order_id         INT NOT NULL REFERENCES service_orders(id),
    vehicle_id       INT NOT NULL REFERENCES vehicles(id),
    treatment_type   VARCHAR(100) NOT NULL,  -- 'Básico', 'Premium', 'Elite'
    operator_id      INT REFERENCES operators(id) ON DELETE SET NULL,
    application_date DATE NOT NULL,
    warranty_months  INT NOT NULL DEFAULT 0,
    warranty_expiry  DATE,                   -- calculado: application_date + warranty_months
    notes            TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ceramic_vehicle_id     ON ceramic_treatments(vehicle_id);
CREATE INDEX idx_ceramic_warranty_expiry ON ceramic_treatments(warranty_expiry);

-- ============================================================
-- LIQUIDACIONES DE OPERARIOS
-- ============================================================

CREATE TABLE liquidations (
    id              SERIAL PRIMARY KEY,
    operator_id     INT NOT NULL REFERENCES operators(id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    total_services  INT NOT NULL DEFAULT 0,
    total_amount    DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- snapshot de la tasa al momento
    commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status          liquidation_status NOT NULL DEFAULT 'pendiente',
    paid_at         TIMESTAMP,
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_liquidations_operator_id ON liquidations(operator_id);
CREATE INDEX idx_liquidations_period      ON liquidations(period_start, period_end);

-- Órdenes incluidas en una liquidación
CREATE TABLE liquidation_orders (
    id              SERIAL PRIMARY KEY,
    liquidation_id  INT NOT NULL REFERENCES liquidations(id) ON DELETE CASCADE,
    order_id        INT NOT NULL REFERENCES service_orders(id),
    order_total     DECIMAL(10, 2) NOT NULL  -- snapshot del total de la orden
);

-- ============================================================
-- INGRESOS Y EGRESOS
-- Movimientos financieros generales del negocio.
-- Una orden pagada genera automáticamente un ingreso aquí.
-- ============================================================

CREATE TABLE transactions (
    id          SERIAL PRIMARY KEY,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    type        transaction_type NOT NULL,
    category    VARCHAR(100),                 -- 'Servicios', 'Insumos', 'Salarios', 'Otros'
    description TEXT,
    amount      DECIMAL(10, 2) NOT NULL,
    order_id    INT REFERENCES service_orders(id) ON DELETE SET NULL, -- ingreso vinculado a orden
    created_by  INT,                          -- FK a users
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);

-- ============================================================
-- DOCUMENTOS
-- ============================================================

CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    type        VARCHAR(50),                  -- 'contrato', 'factura', 'recibo', 'otro'
    file_path   VARCHAR(500) NOT NULL,
    file_size   INT,                          -- bytes
    mime_type   VARCHAR(100),
    -- Relación polimórfica: a qué entidad pertenece este documento
    related_to  VARCHAR(50),                  -- 'order', 'vehicle', 'client', 'general'
    related_id  INT,
    notes       TEXT,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_related ON documents(related_to, related_id);

-- ============================================================
-- USUARIOS DEL SISTEMA
-- ============================================================

CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role         user_role NOT NULL DEFAULT 'recepcion',
    operator_id  INT REFERENCES operators(id) ON DELETE SET NULL, -- si el usuario es un operario
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- FK DIFERIDA: service_orders → appointments
-- (Se define al final para evitar dependencia circular)
-- ============================================================

ALTER TABLE service_orders
    ADD CONSTRAINT fk_orders_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_user
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
