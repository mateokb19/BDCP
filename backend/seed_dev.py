"""
Run once to create tables and load development data.
Usage:  python seed_dev.py
"""
from app.database import engine, SessionLocal
from app import models

# Create all tables
models.Base.metadata.create_all(bind=engine)
print("OK Tables created")

db = SessionLocal()

# Skip if already seeded
if db.query(models.Operator).count() > 0:
    print("Already seeded — skipping.")
    db.close()
    exit()

# ── Operators ──────────────────────────────────────────────────────────────────
operators = [
    models.Operator(name="Carlos Mora",      phone="555-0001", commission_rate=30),
    models.Operator(name="Francisco Currea", phone="555-0002", commission_rate=30),
    models.Operator(name="Luis López",       phone="555-0003", commission_rate=30),
]
db.add_all(operators)
db.flush()

# ── Services ───────────────────────────────────────────────────────────────────
services = [
    models.Service(category="exterior", name="Lavado Básico",              price_automovil=15,  price_camion_estandar=20,  price_camion_xl=25),
    models.Service(category="exterior", name="Lavado Premium",             price_automovil=30,  price_camion_estandar=40,  price_camion_xl=50),
    models.Service(category="exterior", name="Pulido",                     price_automovil=80,  price_camion_estandar=100, price_camion_xl=120),
    models.Service(category="exterior", name="Encerado",                   price_automovil=50,  price_camion_estandar=65,  price_camion_xl=80),
    models.Service(category="interior", name="Limpieza Interior Básica",   price_automovil=25,  price_camion_estandar=35,  price_camion_xl=45),
    models.Service(category="interior", name="Limpieza Interior Profunda", price_automovil=40,  price_camion_estandar=55,  price_camion_xl=70),
    models.Service(category="interior", name="Shampoo Tapicería",          price_automovil=60,  price_camion_estandar=80,  price_camion_xl=100),
    models.Service(category="ceramico", name="Tratamiento Cerámico Básico",   price_automovil=200, price_camion_estandar=250, price_camion_xl=300),
    models.Service(category="ceramico", name="Tratamiento Cerámico Premium",  price_automovil=300, price_camion_estandar=380, price_camion_xl=450),
    models.Service(category="ceramico", name="Tratamiento Cerámico Elite",    price_automovil=500, price_camion_estandar=600, price_camion_xl=750),
]
db.add_all(services)
db.commit()

print(f"OK {len(operators)} operators inserted")
print(f"OK {len(services)} services inserted")
print("Done. Run: python -m uvicorn app.main:app --reload")
db.close()
