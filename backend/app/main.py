from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.database import engine, SessionLocal
from app import models
from app.routers import services, operators, vehicles, orders, patio

# Create tables (no-op if already exist)
models.Base.metadata.create_all(bind=engine)


def _seed_if_empty() -> None:
    """Insert base data the first time the app starts against an empty DB."""
    db = SessionLocal()
    try:
        if db.query(models.Operator).count() > 0:
            return  # already seeded

        db.add_all([
            models.Operator(name="Carlos Mora",      phone="555-0001", commission_rate=30),
            models.Operator(name="Francisco Currea", phone="555-0002", commission_rate=30),
            models.Operator(name="Luis Lopez",       phone="555-0003", commission_rate=30),
        ])
        db.add_all([
            models.Service(category="exterior", name="Lavado Basico",              price_automovil=15,  price_camion_estandar=20,  price_camion_xl=25),
            models.Service(category="exterior", name="Lavado Premium",             price_automovil=30,  price_camion_estandar=40,  price_camion_xl=50),
            models.Service(category="exterior", name="Pulido",                     price_automovil=80,  price_camion_estandar=100, price_camion_xl=120),
            models.Service(category="exterior", name="Encerado",                   price_automovil=50,  price_camion_estandar=65,  price_camion_xl=80),
            models.Service(category="interior", name="Limpieza Interior Basica",   price_automovil=25,  price_camion_estandar=35,  price_camion_xl=45),
            models.Service(category="interior", name="Limpieza Interior Profunda", price_automovil=40,  price_camion_estandar=55,  price_camion_xl=70),
            models.Service(category="interior", name="Shampoo Tapiceria",          price_automovil=60,  price_camion_estandar=80,  price_camion_xl=100),
            models.Service(category="ceramico", name="Tratamiento Ceramico Basico",   price_automovil=200, price_camion_estandar=250, price_camion_xl=300),
            models.Service(category="ceramico", name="Tratamiento Ceramico Premium",  price_automovil=300, price_camion_estandar=380, price_camion_xl=450),
            models.Service(category="ceramico", name="Tratamiento Ceramico Elite",    price_automovil=500, price_camion_estandar=600, price_camion_xl=750),
        ])
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


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok"}
