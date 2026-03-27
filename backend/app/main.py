from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import text

from app.database import engine, SessionLocal
from app import models
from app.routers import services, operators, vehicles, orders, patio, history, ceramics, liquidation, appointments, ingresos, egresos, clients

# Create tables (no-op if already exist)
models.Base.metadata.create_all(bind=engine)

# Incremental migrations (idempotent)
with engine.connect() as _conn:
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "
        "week_liquidation_id INTEGER REFERENCES week_liquidations(id) ON DELETE SET NULL"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS downpayment NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    _conn.execute(text(
        "ALTER TABLE patio ADD COLUMN IF NOT EXISTS scheduled_delivery_at TIMESTAMP"
    ))
    _conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(20)"))
    _conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS tipo_identificacion VARCHAR(50)"))
    _conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS identificacion VARCHAR(30)"))
    _conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS dv VARCHAR(2)"))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_cash NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_datafono NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_nequi NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_bancolombia NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='week_liquidations' AND column_name='payment_transfer') THEN
            ALTER TABLE week_liquidations ALTER COLUMN payment_transfer SET DEFAULT 0;
          END IF;
        END $$
    """))
    _conn.execute(text(
        "ALTER TABLE week_liquidations ADD COLUMN IF NOT EXISTS payment_datafono NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE week_liquidations ADD COLUMN IF NOT EXISTS payment_nequi NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE week_liquidations ADD COLUMN IF NOT EXISTS payment_bancolombia NUMERIC(12,2) NOT NULL DEFAULT 0"
    ))
    _conn.execute(text(
        "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS downpayment_method VARCHAR(50)"
    ))
    _conn.execute(text(
        "ALTER TABLE operators ADD COLUMN IF NOT EXISTS operator_type VARCHAR(30) NOT NULL DEFAULT 'detallado'"
    ))
    _conn.execute(text(
        "ALTER TABLE service_order_items ADD COLUMN IF NOT EXISTS standard_price NUMERIC(10,2)"
    ))
    _conn.execute(text(
        "UPDATE service_order_items SET standard_price = unit_price WHERE standard_price IS NULL"
    ))
    _conn.execute(text(
        "ALTER TABLE debts ADD COLUMN IF NOT EXISTS "
        "week_liquidation_id INTEGER REFERENCES week_liquidations(id) ON DELETE SET NULL"
    ))
    # Remove legacy detallado operator if present
    _conn.execute(text(
        "DELETE FROM operators WHERE name = 'Jose Domingo Lindarte' AND operator_type = 'detallado'"
    ))
    # Seed new specialist operators if not present
    _conn.execute(text(
        "INSERT INTO operators (name, commission_rate, operator_type, active) "
        "SELECT 'Jose D. Lindarte', 30, 'pintura', true "
        "WHERE NOT EXISTS (SELECT 1 FROM operators WHERE name = 'Jose D. Lindarte')"
    ))
    _conn.execute(text(
        "INSERT INTO operators (name, commission_rate, operator_type, active) "
        "SELECT 'Enrique Rodríguez', 30, 'latoneria', true "
        "WHERE NOT EXISTS (SELECT 1 FROM operators WHERE name = 'Enrique Rodríguez')"
    ))
    _conn.commit()


_EXPECTED_SERVICES = 55

_SERVICES_SEED = [
    # ── Servicios Básicos / Exterior ─────────────────────────────────────
    dict(category="exterior", name="Premium Wash",                 price_automovil=51000,   price_camion_estandar=60000,   price_camion_xl=66000),
    dict(category="exterior", name="Premium Wash Hidrofobic",      price_automovil=85000,   price_camion_estandar=95000,   price_camion_xl=110000),
    dict(category="exterior", name="Detallado de Llantas",         price_automovil=165000,  price_camion_estandar=195000,  price_camion_xl=195000),
    dict(category="exterior", name="Chasis + Premium Wash",        price_automovil=94000,   price_camion_estandar=105000,  price_camion_xl=115000),
    dict(category="exterior", name="Motor Detailing + Vapor",      price_automovil=220000,  price_camion_estandar=245000,  price_camion_xl=270000),
    dict(category="exterior", name="Motor + Premium Wash",         price_automovil=130000,  price_camion_estandar=150000,  price_camion_xl=170000),
    dict(category="exterior", name="Premium Wash + Chasis + Motor",price_automovil=145000,  price_camion_estandar=170000,  price_camion_xl=190000),
    dict(category="exterior", name="Hidrophobic + Chasis",         price_automovil=130000,  price_camion_estandar=145000,  price_camion_xl=160000),
    dict(category="exterior", name="Wax Service",                  price_automovil=125000,  price_camion_estandar=145000,  price_camion_xl=160000),
    dict(category="exterior", name="Wash and Protect",             price_automovil=180000,  price_camion_estandar=205000,  price_camion_xl=225000),
    dict(category="exterior", name="Descontamination Service",     price_automovil=215000,  price_camion_estandar=226000,  price_camion_xl=300000),
    # ── Servicios Interior ───────────────────────────────────────────────
    dict(category="interior", name="Estrene Otra Vez",             price_automovil=395000,  price_camion_estandar=460000,  price_camion_xl=560000),
    dict(category="interior", name="Carpet Renew",                 price_automovil=300000,  price_camion_estandar=320000,  price_camion_xl=360000),
    dict(category="interior", name="Combo, Asientos y Carteras",   price_automovil=290000,  price_camion_estandar=320000,  price_camion_xl=390000),
    dict(category="interior", name="Limpieza Asientos",            price_automovil=175000,  price_camion_estandar=185000,  price_camion_xl=195000),
    dict(category="interior", name="Limpieza de Techo",            price_automovil=220000,  price_camion_estandar=245000,  price_camion_xl=270000),
    dict(category="interior", name="Limpieza Interior Basica",     price_automovil=170000,  price_camion_estandar=200000,  price_camion_xl=230000),
    dict(category="interior", name="Limpieza Tapete",              price_automovil=170000,  price_camion_estandar=210000,  price_camion_xl=260000),
    dict(category="interior", name="Hidratacion Cuero",            price_automovil=85000,   price_camion_estandar=85000,   price_camion_xl=105000),
    dict(category="interior", name="Interior Protection",          price_automovil=870000,  price_camion_estandar=1000000, price_camion_xl=1150000),
    # ── Corrección de Pintura ────────────────────────────────────────────
    dict(category="correccion_pintura", name="Rejuvenecimiento de Pintura",  price_automovil=335000, price_camion_estandar=390000, price_camion_xl=430000),
    dict(category="correccion_pintura", name="Exterior Detailing Service",   price_automovil=490000, price_camion_estandar=600000, price_camion_xl=650000),
    dict(category="correccion_pintura", name="Restoration to Shine",         price_automovil=680000, price_camion_estandar=810000, price_camion_xl=940000),
    dict(category="correccion_pintura", name="Signature",                    price_automovil=800000, price_camion_estandar=920000, price_camion_xl=1150000),
    # ── Protección Cerámica ──────────────────────────────────────────────
    dict(category="ceramico", name="Superior Shine +9 EXCLUSIVE", price_automovil=3400000, price_camion_estandar=3950000, price_camion_xl=4500000),
    dict(category="ceramico", name="Superior Shine +9",           price_automovil=2780000, price_camion_estandar=2980000, price_camion_xl=3380000),
    dict(category="ceramico", name="Superior Shine +5",           price_automovil=2050000, price_camion_estandar=2300000, price_camion_xl=2500000),
    dict(category="ceramico", name="Superior Shine +2",           price_automovil=980000,  price_camion_estandar=1300000, price_camion_xl=1450000),
    dict(category="ceramico", name="Mantenimiento Cerámico",      price_automovil=400000,  price_camion_estandar=450000,  price_camion_xl=500000),
    # ── PPF ─────────────────────────────────────────────────────────────────
    dict(category="ppf", name="PPF Full",                         price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="ppf", name="PPF Parcial",                      price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    # ── Polarizado ───────────────────────────────────────────────────────────
    dict(category="polarizado", name="Polarizado Llumar IRX / ATR", price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    # ── Pintura (precio por pieza, igual para todos los tipos) ───────────────
    dict(category="pintura", name="Bumper delantero",             price_automovil=430000, price_camion_estandar=430000, price_camion_xl=430000),
    dict(category="pintura", name="Parcial bumper delantero",     price_automovil=220000, price_camion_estandar=220000, price_camion_xl=220000),
    dict(category="pintura", name="Capot",                        price_automovil=860000, price_camion_estandar=860000, price_camion_xl=860000),
    dict(category="pintura", name="Tapa baúl",                    price_automovil=430000, price_camion_estandar=430000, price_camion_xl=430000),
    dict(category="pintura", name="Bumper trasero",               price_automovil=430000, price_camion_estandar=430000, price_camion_xl=430000),
    dict(category="pintura", name="Parcial bumper trasero",       price_automovil=220000, price_camion_estandar=220000, price_camion_xl=220000),
    dict(category="pintura", name="Puerta",                       price_automovil=430000, price_camion_estandar=430000, price_camion_xl=430000),
    dict(category="pintura", name="Espejo",                       price_automovil=220000, price_camion_estandar=220000, price_camion_xl=220000),
    dict(category="pintura", name="Estribos",                     price_automovil=220000, price_camion_estandar=220000, price_camion_xl=220000),
    dict(category="pintura", name="Extensión",                    price_automovil=220000, price_camion_estandar=220000, price_camion_xl=220000),
    dict(category="pintura", name="Guardafangos",                 price_automovil=430000, price_camion_estandar=430000, price_camion_xl=430000),
    # ── Latonería (precio variable) ──────────────────────────────────────────
    dict(category="latoneria", name="Bumper",                     price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Capot",                      price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Puerta baúl",                price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Bumper trasero",             price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Puerta",                     price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Espejo",                     price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Estribos",                   price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Extensión",                  price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Guardafangos",               price_automovil=0, price_camion_estandar=0, price_camion_xl=0),
    dict(category="latoneria", name="Desmonte/Monte de Bumper",   price_automovil=110000, price_camion_estandar=110000, price_camion_xl=110000),
    dict(category="latoneria", name="PDR",                        price_automovil=200000, price_camion_estandar=200000, price_camion_xl=200000),
    dict(category="latoneria", name="Arreglo Rin",                price_automovil=250000, price_camion_estandar=250000, price_camion_xl=250000),
]


def _seed_if_empty() -> None:
    """Insert base data on first start; resync services if the catalog changed."""
    db = SessionLocal()
    try:
        if db.query(models.Operator).count() == 0:
            db.add_all([
                models.Operator(name="Carlos Mora",        phone="555-0001", commission_rate=30, operator_type="detallado"),
                models.Operator(name="Francisco Currea",   phone="555-0002", commission_rate=30, operator_type="detallado"),
                models.Operator(name="Luis Lopez",         phone="555-0003", commission_rate=30, operator_type="detallado"),
                models.Operator(name="Jose D. Lindarte",   commission_rate=30, operator_type="pintura"),
                models.Operator(name="Enrique Rodríguez",  commission_rate=30, operator_type="latoneria"),
            ])
            db.commit()

        if db.query(models.Service).count() != _EXPECTED_SERVICES:
            db.query(models.Service).delete()
            db.add_all([models.Service(**s) for s in _SERVICES_SEED])
            db.commit()
    finally:
        db.close()


_seed_if_empty()

app = FastAPI(
    title="BDCPolo API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"
app.include_router(services.router, prefix=API)
app.include_router(operators.router, prefix=API)
app.include_router(vehicles.router,  prefix=API)
app.include_router(orders.router,    prefix=API)
app.include_router(patio.router,     prefix=API)
app.include_router(history.router,   prefix=API)
app.include_router(ceramics.router,      prefix=API)
app.include_router(liquidation.router,   prefix=API)
app.include_router(appointments.router,  prefix=API)
app.include_router(ingresos.router,      prefix=API)
app.include_router(egresos.router,       prefix=API)
app.include_router(clients.router,       prefix=API)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}
