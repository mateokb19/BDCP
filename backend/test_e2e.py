#!/usr/bin/env python3
"""
test_e2e.py — End-to-end test for mixed order (detallado + pintura + latonería).
Tests the latonería commission flow and liquidation tracking.

Usage:
  python test_e2e.py

Requirements:
  - Backend running at http://localhost:8000
  - pip install requests  (usually already present in the venv)
"""

import sys
import random
import string
from datetime import date, timedelta
import requests

BASE = "http://localhost:28000/api/v1"
LATONERIA_OPERATOR_PAY   = 150_000   # what we'll pay Enrique per service
LAT_CLIENT_PRICE_OVERRIDE = 250_000  # what the client pays for latonería

results: list[tuple[str, str]] = []

# Unique plates for this test run (6 uppercase alphanum chars)
_suffix = "".join(random.choices(string.digits, k=4))
PLATE1 = f"T1{_suffix}"
PLATE2 = f"T2{_suffix}"


def step(name: str):
    print(f"\n{'=' * 60}\n[STEP] {name}\n{'=' * 60}")


def ok(msg: str):
    print(f"  [PASS] {msg}")
    results.append(("PASS", msg))


def fail(msg: str):
    print(f"  [FAIL] FALLO: {msg}")
    results.append(("FAIL", msg))


def api(method: str, path: str, **kwargs):
    r = getattr(requests, method)(f"{BASE}{path}", **kwargs)
    if not r.ok:
        print(f"  ERROR {r.status_code}: {r.text[:600]}")
        sys.exit(f"API call failed: {method.upper()} {path}")
    return r.json()


def week_start_sunday(d: date) -> date:
    """Return the Sunday that starts the ISO-week used by BDCP (Sun–Sat)."""
    return d - timedelta(days=d.isoweekday() % 7)


# ── 1. Discover service IDs ───────────────────────────────────────────────────
step("1. Descubrir IDs de servicios")

services = api("get", "/services")

ext_svc = next((s for s in services if s["category"] == "exterior"), None)
# Find a pintura service worth exactly 430 000 (= 1 pieza -> comisión 90 000)
pin_svc = next(
    (s for s in services
     if s["category"] == "pintura" and float(s["price_automovil"]) == 430_000),
    None,
)
lat_svc = next((s for s in services if s["category"] == "latoneria"), None)

assert ext_svc, "No se encontró servicio de categoría exterior"
assert pin_svc, "No se encontró servicio de pintura con price_automovil = 430 000"
assert lat_svc, "No se encontró servicio de categoría latonería"

print(f"  Exterior : [{ext_svc['id']}] {ext_svc['name']}  "
      f"${float(ext_svc['price_automovil']):,.0f}")
print(f"  Pintura  : [{pin_svc['id']}] {pin_svc['name']}  "
      f"${float(pin_svc['price_automovil']):,.0f}  (1 pieza)")
print(f"  Latonería: [{lat_svc['id']}] {lat_svc['name']}  "
      f"(override cliente ${LAT_CLIENT_PRICE_OVERRIDE:,})")


# ── 2. Discover operator IDs ──────────────────────────────────────────────────
step("2. Descubrir IDs de operarios")

operators = api("get", "/operators")

carlos  = next((o for o in operators
                if o["operator_type"] == "detallado" and "Carlos" in o["name"]), None)
jose    = next((o for o in operators if o["operator_type"] == "pintura"), None)
enrique = next((o for o in operators if o["operator_type"] == "latoneria"), None)

assert carlos,  "No se encontró operario tipo detallado (Carlos)"
assert jose,    "No se encontró operario tipo pintura"
assert enrique, "No se encontró operario tipo latonería"

print(f"  Detallado : [{carlos['id']}]  {carlos['name']}  "
      f"{float(carlos['commission_rate'])}%")
print(f"  Pintura   : [{jose['id']}]   {jose['name']}")
print(f"  Latonería : [{enrique['id']}]  {enrique['name']}")


# ── 3. Create mixed order ─────────────────────────────────────────────────────
step(f"3. Crear orden mixta (exterior + pintura + latoneria) -- placa {PLATE1}")

order = api("post", "/orders", json={
    "vehicle_type": "automovil",
    "plate": PLATE1,
    "brand": "Toyota",
    "model": "Corolla",
    "color": "Blanco",
    "client_name": "Juan Prueba",
    "client_phone": "3001234567",
    "service_ids": [ext_svc["id"], pin_svc["id"], lat_svc["id"]],
    "item_overrides": [
        {"service_id": lat_svc["id"], "unit_price": LAT_CLIENT_PRICE_OVERRIDE}
    ],
})

order_id    = order["id"]
order_total = float(order["total"])
print(f"  Orden creada : #{order['order_number']}  "
      f"total=${order_total:,.0f}")
ok(f"Orden #{order['order_number']} creada — total=${order_total:,.0f}")


# ── 4. Find patio entry ───────────────────────────────────────────────────────
step("4. Localizar entrada de patio")

all_patio = api("get", "/patio")
patio     = next((p for p in all_patio if p["order"]["id"] == order_id), None)
assert patio, f"No se encontró entrada de patio para order_id={order_id}"
patio_id = patio["id"]
print(f"  patio_id={patio_id}  estado={patio['status']}")


# ── 5. Assign detallado operator ──────────────────────────────────────────────
step("5. Asignar operario (Carlos Mora) vía PATCH /patio/{id}")

api("patch", f"/patio/{patio_id}", json={"operator_id": carlos["id"]})
print(f"  Operario asignado: {carlos['name']}")


# ── 6–8. Advance patio through all statuses ───────────────────────────────────
step("6. Avanzar: esperando -> en_proceso")
api("post", f"/patio/{patio_id}/advance", json={})

step("7. Avanzar: en_proceso -> listo")
api("post", f"/patio/{patio_id}/advance", json={})

step("8. Avanzar: listo -> entregado  (pago + latoneria_operator_pay)")
api("post", f"/patio/{patio_id}/advance", json={
    "payment_cash":        order_total,
    "payment_datafono":    0,
    "payment_nequi":       0,
    "payment_bancolombia": 0,
    "latoneria_operator_pay": LATONERIA_OPERATOR_PAY,
})
ok(f"Orden entregada — payment_cash=${order_total:,.0f}, "
   f"latoneria_operator_pay=${LATONERIA_OPERATOR_PAY:,}")


# ── 9–11. Liquidate each operator for the current week ────────────────────────
ws = str(week_start_sunday(date.today()))
print(f"\n  week_start (domingo) = {ws}")

ext_std = float(ext_svc["price_automovil"])
rate    = float(carlos["commission_rate"]) / 100

expected_carlos  = round(ext_std * rate, 2)
expected_jose    = 90_000   # Capot = 1 pieza × $90 000
expected_enrique = LATONERIA_OPERATOR_PAY

step(f"9. Liquidar {carlos['name']} (detallado)  — esperado ${expected_carlos:,.2f}")
liq_c = api("post", f"/liquidation/{carlos['id']}/liquidate",
            params={"week_start": ws},
            json={"payment_cash": expected_carlos})
comm_c = float(liq_c["commission_amount"])
print(f"  commission_amount = ${comm_c:,.2f}")
if abs(comm_c - expected_carlos) < 1:
    ok(f"Carlos: comisión correcta ${comm_c:,.2f}")
else:
    fail(f"Carlos: comisión ${comm_c:,.2f} != esperado ${expected_carlos:,.2f}")

step(f"10. Liquidar {jose['name']} (pintura)  — esperado ${expected_jose:,.0f}")
liq_j = api("post", f"/liquidation/{jose['id']}/liquidate",
            params={"week_start": ws},
            json={"payment_cash": expected_jose})
comm_j = float(liq_j["commission_amount"])
print(f"  commission_amount = ${comm_j:,.2f}")
if abs(comm_j - expected_jose) < 1:
    ok(f"Jose: comisión correcta ${comm_j:,.2f}")
else:
    fail(f"Jose: comisión ${comm_j:,.2f} != esperado ${expected_jose:,.2f}")

step(f"11. Liquidar {enrique['name']} (latonería)  — esperado ${expected_enrique:,}")
liq_e = api("post", f"/liquidation/{enrique['id']}/liquidate",
            params={"week_start": ws},
            json={"payment_cash": expected_enrique})
comm_e = float(liq_e["commission_amount"])
print(f"  commission_amount = ${comm_e:,.2f}")
if abs(comm_e - expected_enrique) < 1:
    ok(f"Enrique: comisión correcta ${comm_e:,.2f}")
else:
    fail(f"Enrique: comisión ${comm_e:,.2f} != esperado ${expected_enrique:,.2f}")


# ── 12–14. Verify reports ─────────────────────────────────────────────────────
today_str = str(date.today())

step("12. Reporte Carlos Mora — verificar is_liquidated")
rep_c  = api("get", f"/liquidation/{carlos['id']}/report",
             params={"period": "week", "ref_date": today_str})
liq_orders_c = [o for o in rep_c["orders"] if o["is_liquidated"]]
print(f"  total órdenes={len(rep_c['orders'])}  liquidadas={len(liq_orders_c)}")
if len(rep_c["orders"]) > 0 and all(o["is_liquidated"] for o in rep_c["orders"]):
    ok("Carlos: todas las órdenes aparecen como liquidadas en el reporte")
else:
    fail("Carlos: hay órdenes sin liquidar en el reporte")

step("13. Reporte Jose D. Lindarte — verificar is_liquidated")
rep_j  = api("get", f"/liquidation/{jose['id']}/report",
             params={"period": "week", "ref_date": today_str})
print(f"  total órdenes={len(rep_j['orders'])}  "
      f"liquidadas={sum(1 for o in rep_j['orders'] if o['is_liquidated'])}")
if len(rep_j["orders"]) > 0 and all(o["is_liquidated"] for o in rep_j["orders"]):
    ok("Jose: todas las órdenes aparecen como liquidadas en el reporte")
else:
    fail("Jose: hay órdenes sin liquidar en el reporte")

step("14. Reporte Enrique Rodríguez — verificar is_liquidated + commission_amount")
rep_e  = api("get", f"/liquidation/{enrique['id']}/report",
             params={"period": "week", "ref_date": today_str})
comm_rep_e = float(rep_e["commission_amount"])
print(f"  total órdenes={len(rep_e['orders'])}  "
      f"liquidadas={sum(1 for o in rep_e['orders'] if o['is_liquidated'])}")
print(f"  commission_amount en reporte = ${comm_rep_e:,.2f}")
if len(rep_e["orders"]) > 0 and all(o["is_liquidated"] for o in rep_e["orders"]):
    ok("Enrique: todas las órdenes aparecen como liquidadas en el reporte")
else:
    fail("Enrique: hay órdenes sin liquidar en el reporte")
if abs(comm_rep_e - expected_enrique) < 1:
    ok(f"Enrique: commission_amount en reporte = ${comm_rep_e:,.2f} (pago acordado, no %)")
else:
    fail(f"Enrique: commission_amount en reporte ${comm_rep_e:,.2f} != ${expected_enrique:,}")


# ── 15. Segunda orden (solo exterior) + re-liquidación de Carlos ──────────────
step(f"15. Segunda orden solo exterior ({PLATE2}) + re-liquidar Carlos")

order2 = api("post", "/orders", json={
    "vehicle_type": "automovil",
    "plate": PLATE2,
    "brand": "Honda",
    "model": "Civic",
    "color": "Negro",
    "client_name": "Maria Prueba",
    "client_phone": "3009876543",
    "service_ids": [ext_svc["id"]],
    "item_overrides": [],
})
order2_id    = order2["id"]
order2_total = float(order2["total"])
print(f"  Orden 2 creada: #{order2['order_number']}  total=${order2_total:,.0f}")

# Find patio entry
all_patio2 = api("get", "/patio")
patio2 = next((p for p in all_patio2 if p["order"]["id"] == order2_id), None)
assert patio2, f"No se encontró patio para orden 2 (id={order2_id})"
patio2_id = patio2["id"]

api("patch", f"/patio/{patio2_id}", json={"operator_id": carlos["id"]})
api("post",  f"/patio/{patio2_id}/advance", json={})
api("post",  f"/patio/{patio2_id}/advance", json={})
api("post",  f"/patio/{patio2_id}/advance", json={"payment_cash": order2_total})
print("  Orden 2 entregada")

# Re-liquidate Carlos for the 2nd order
expected_carlos2 = round(ext_std * rate, 2)
liq_c2 = api("post", f"/liquidation/{carlos['id']}/liquidate",
             params={"week_start": ws},
             json={"payment_cash": expected_carlos2})
print(f"  Re-liquidación Carlos: unliquidated_count = {liq_c2.get('unliquidated_count', '?')}")

# Verify that order #1 is still marked as liquidated in the week view
week_c = api("get", f"/liquidation/{carlos['id']}/week", params={"week_start": ws})
all_week_orders = [o for day in week_c["days"] for o in day["orders"]]
order1_row = next((o for o in all_week_orders if o["order_id"] == order_id), None)

if order1_row:
    print(f"  Orden #1 is_liquidated = {order1_row['is_liquidated']}")
    if order1_row["is_liquidated"]:
        ok("Carlos: orden #1 sigue liquidada tras re-liquidar con orden #2 "
           "(no reaparece como pendiente)")
    else:
        fail("Carlos: orden #1 reaparece como pendiente tras añadir orden #2 — BUG")
else:
    fail("Carlos: orden #1 no aparece en la vista semanal")


# ── 16. Verify Enrique has no new unliquidated orders ────────────────────────
step("16. Verificar que Enrique no tiene pendientes (latoneria_liquidation_id)")

week_e2 = api("get", f"/liquidation/{enrique['id']}/week", params={"week_start": ws})
enrique_orders = [o for day in week_e2["days"] for o in day["orders"]]
print(f"  Órdenes Enrique esta semana: {len(enrique_orders)}")
print(f"  unliquidated_count = {week_e2.get('unliquidated_count', '?')}")

if all(o["is_liquidated"] for o in enrique_orders):
    ok("Enrique: ninguna orden reaparece como pendiente — latoneria_liquidation_id OK")
else:
    unliq = [o for o in enrique_orders if not o["is_liquidated"]]
    fail(f"Enrique: {len(unliq)} orden(es) reaparecen como pendientes — BUG")


# ── Final summary ─────────────────────────────────────────────────────────────
print(f"\n{'=' * 60}")
print("RESUMEN FINAL")
print('=' * 60)
passed = [r for r in results if r[0] == "PASS"]
failed = [r for r in results if r[0] == "FAIL"]
for r in results:
    icon = "[PASS]" if r[0] == "PASS" else "[FAIL]"
    print(f"  {icon}  {r[1]}")
print(f"\n  {len(passed)} PASS  /  {len(failed)} FAIL")
if failed:
    sys.exit(1)
else:
    print("\n  [OK] TODOS LOS TESTS PASARON\n")
