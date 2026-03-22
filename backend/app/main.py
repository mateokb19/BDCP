from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import text

from app.database import engine, SessionLocal
from app import models
from app.routers import services, operators, vehicles, orders, patio, history, ceramics, liquidation, appointments, ingresos, egresos

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
    _conn.commit()


_EXPECTED_SERVICES = 28

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
]


def _seed_if_empty() -> None:
    """Insert base data on first start; resync services if the catalog changed."""
    db = SessionLocal()
    try:
        if db.query(models.Operator).count() == 0:
            db.add_all([
                models.Operator(name="Carlos Mora",      phone="555-0001", commission_rate=30),
                models.Operator(name="Francisco Currea", phone="555-0002", commission_rate=30),
                models.Operator(name="Luis Lopez",       phone="555-0003", commission_rate=30),
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://frontend:5173",
    ],
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


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}
