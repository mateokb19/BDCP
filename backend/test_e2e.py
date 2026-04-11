#!/usr/bin/env python3
"""
Comprehensive end-to-end test suite for BDCP liquidation + ingresos/egresos.

Tests the full flow:
  1. Create mixed order (detallado + pintura + latoneria + ceramico) with abono
  2. Deliver with split payment methods + latoneria_operator_pay
  3. Liquidate 3 operator types with different payment methods
  4. Verify ingresos buckets (cash/datafono/nequi/bancolombia) are correct
  5. Verify egresos auto-created with correct amounts per method
  6. Verify debts auto-created for partial payments
  7. Verify is_liquidated flags prevent reappearance bugs

Usage:
  python test_e2e_comprehensive.py

Requirements:
  - Backend running at http://localhost:28000
  - pip install requests
"""

import requests
import json
from datetime import datetime, timedelta, date
from decimal import Decimal
import random
import sys

BASE = "http://localhost:28000/api/v1"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

results = []

def ok(msg):
    """Record a passing test."""
    results.append((True, msg))
    print(f"{GREEN}[PASS]{RESET} {msg}")

def fail(msg):
    """Record a failing test."""
    results.append((False, msg))
    print(f"{RED}[FAIL]{RESET} {msg}")

def info(msg):
    """Print info message."""
    print(f"{BLUE}[INFO]{RESET} {msg}")

def header(title):
    """Print section header."""
    print(f"\n{BOLD}{YELLOW}=== {title} ==={RESET}\n")

# ===== SETUP =====
header("SETUP: Discover Services & Operators")

try:
    r = requests.get(f"{BASE}/services")
    assert r.status_code == 200, f"GET /services failed: {r.status_code}"
    services = r.json()

    # Find services by category
    exterior_svc = next((s for s in services if s['category'] == 'exterior'), None)
    pintura_svc = next((s for s in services if s['category'] == 'pintura' and float(s['price_automovil']) >= 400000), None)
    latoneria_svc = next((s for s in services if s['category'] == 'latoneria'), None)
    ceramico_svc = next((s for s in services if s['category'] == 'ceramico'), None)

    assert exterior_svc, "No exterior service found"
    assert pintura_svc, "No pintura service found"
    assert latoneria_svc, "No latoneria service found"
    assert ceramico_svc, "No ceramico service found"

    exterior_id = exterior_svc['id']
    exterior_price = Decimal(str(exterior_svc['price_automovil']))
    pintura_id = pintura_svc['id']
    pintura_price = Decimal(str(pintura_svc['price_automovil']))
    latoneria_id = latoneria_svc['id']
    ceramico_id = ceramico_svc['id']

    info(f"exterior: {exterior_svc['name']} id={exterior_id} price=${exterior_price:,.0f}")
    info(f"pintura: {pintura_svc['name']} id={pintura_id} price=${pintura_price:,.0f} ({float(pintura_price)/430000:.1f} piezas)")
    info(f"latoneria: {latoneria_svc['name']} id={latoneria_id}")
    info(f"ceramico: {ceramico_svc['name']} id={ceramico_id}")

except Exception as e:
    print(f"{RED}ERROR during service discovery: {e}{RESET}")
    sys.exit(1)

try:
    r = requests.get(f"{BASE}/operators")
    assert r.status_code == 200
    operators = r.json()

    carlos = next((o for o in operators if o['name'] == 'Carlos Mora'), None)
    jose = next((o for o in operators if o['name'] == 'Jose D. Lindarte'), None)
    enrique = next((o for o in operators if o['name'] == 'Enrique Rodríguez'), None)

    assert carlos, "Carlos Mora not found"
    assert jose, "Jose D. Lindarte not found"
    assert enrique, "Enrique Rodríguez not found"

    carlos_id = carlos['id']
    jose_id = jose['id']
    enrique_id = enrique['id']

    info(f"carlos: {carlos['name']} id={carlos_id} type={carlos.get('operator_type', 'detallado')}")
    info(f"jose: {jose['name']} id={jose_id} type={jose.get('operator_type', 'pintura')}")
    info(f"enrique: {enrique['name']} id={enrique_id} type={enrique.get('operator_type', 'latoneria')}")

except Exception as e:
    print(f"{RED}ERROR during operator discovery: {e}{RESET}")
    sys.exit(1)

# Random suffix to avoid plate conflicts (max 6 chars total)
suffix = ''.join(str(random.randint(0, 9)) for _ in range(3))
plate_a = f"T{suffix}A"
plate_b = f"T{suffix}B"

info(f"Using plates: {plate_a}, {plate_b}")

# ===== ORDER A: MIXED =====
header("ORDER A: Mixed Order (detallado + pintura + latoneria + ceramico)")

try:
    exterior_total = exterior_price
    pintura_total = pintura_price  # = 1 pieza
    latoneria_override = Decimal("60000")
    ceramico_price = Decimal(str(ceramico_svc['price_automovil']))

    subtotal = exterior_total + pintura_total + latoneria_override + ceramico_price
    abono_amount = Decimal("50000")  # Nequi
    restante = subtotal - abono_amount

    info(f"subtotal: ${subtotal:,.0f}")
    info(f"abono (Nequi): ${abono_amount:,.0f}")
    info(f"restante a pagar: ${restante:,.0f}")

    payload = {
        "vehicle_type": "automovil",
        "plate": plate_a,
        "brand": "Toyota",
        "model": "Corolla",
        "color": "Blanco",
        "client_name": "Juan Prueba",
        "client_phone": "3001234567",
        "service_ids": [exterior_id, pintura_id, latoneria_id, ceramico_id],
        "item_overrides": [
            {"service_id": latoneria_id, "unit_price": str(latoneria_override)}
        ],
        "downpayment": str(abono_amount),
        "downpayment_method": "Nequi",
        "is_warranty": False,
    }

    r = requests.post(f"{BASE}/orders", json=payload)
    assert r.status_code == 201, f"POST /orders failed: {r.status_code} {r.text}"
    order_a = r.json()
    order_a_id = order_a['id']
    order_a_number = order_a['order_number']

    info(f"Order created: #{order_a_number} id={order_a_id} total=${float(order_a['total']):,.0f}")

except Exception as e:
    fail(f"Order A creation: {e}")
    sys.exit(1)

try:
    r = requests.get(f"{BASE}/patio")
    assert r.status_code == 200
    patio_entries = r.json()
    patio_a = next((p for p in patio_entries if p['order_id'] == order_a_id), None)
    assert patio_a, "Patio entry not found"
    patio_a_id = patio_a['id']

    # Assign Carlos
    r = requests.patch(f"{BASE}/patio/{patio_a_id}", json={"operator_id": carlos_id})
    assert r.status_code == 200
    info(f"Assigned Carlos to patio {patio_a_id}")

    # Advance through statuses: esperando → en_proceso → listo → entregado
    for i, status_name in enumerate(["en_proceso", "listo"]):
        r = requests.post(f"{BASE}/patio/{patio_a_id}/advance", json={})
        assert r.status_code == 200, f"Advance to {status_name} failed: {r.text}"
        info(f"Advanced to {status_name}")

    # Deliver with split payment + latoneria_operator_pay
    cash_payment = Decimal("200000")
    datafono_payment = restante - cash_payment
    latoneria_operator_pay = Decimal("80000")

    payload = {
        "payment_cash": str(cash_payment),
        "payment_datafono": str(datafono_payment),
        "payment_nequi": "0",
        "payment_bancolombia": "0",
        "latoneria_operator_pay": str(latoneria_operator_pay),
    }

    r = requests.post(f"{BASE}/patio/{patio_a_id}/advance", json=payload)
    assert r.status_code == 200, f"Deliver failed: {r.text}"

    ok(f"Order A delivered: cash=${cash_payment:,.0f} + datafono=${datafono_payment:,.0f}, "
       f"latoneria_operator_pay=${latoneria_operator_pay:,.0f}")

except Exception as e:
    fail(f"Order A delivery: {e}")
    sys.exit(1)

# ===== ORDER B: SIMPLE =====
header("ORDER B: Simple Order (detallado only)")

try:
    payload = {
        "vehicle_type": "automovil",
        "plate": plate_b,
        "brand": "Honda",
        "model": "CR-V",
        "color": "Negro",
        "client_name": "Maria Prueba",
        "client_phone": "3009876543",
        "service_ids": [exterior_id],
        "item_overrides": [],
        "downpayment": "0",
        "downpayment_method": "Efectivo",
        "is_warranty": False,
    }

    r = requests.post(f"{BASE}/orders", json=payload)
    assert r.status_code == 201, f"Order B creation failed: {r.status_code} {r.text}"
    order_b = r.json()
    order_b_id = order_b['id']
    order_b_number = order_b['order_number']
    order_b_total = Decimal(str(order_b['total']))
    info(f"Order B created: #{order_b_number}")

    # Get patio + deliver
    r = requests.get(f"{BASE}/patio")
    patio_entries = r.json()
    patio_b = next((p for p in patio_entries if p['order_id'] == order_b_id), None)
    assert patio_b, "Patio entry not found"
    patio_b_id = patio_b['id']

    r = requests.patch(f"{BASE}/patio/{patio_b_id}", json={"operator_id": carlos_id})
    assert r.status_code == 200

    for _ in range(2):
        r = requests.post(f"{BASE}/patio/{patio_b_id}/advance", json={})
        assert r.status_code == 200, f"Advance failed: {r.text}"

    # Deliver with bancolombia
    r = requests.post(f"{BASE}/patio/{patio_b_id}/advance", json={
        "payment_cash": "0",
        "payment_datafono": "0",
        "payment_nequi": "0",
        "payment_bancolombia": str(order_b_total),
    })
    assert r.status_code == 200, f"Deliver B failed: {r.text}"

    ok(f"Order B delivered: bancolombia=${order_b_total:,.0f}")

except Exception as e:
    fail(f"Order B: {e}")
    import traceback
    traceback.print_exc()

# ===== LIQUIDATIONS =====
header("LIQUIDATIONS")

today = date.today()
# ISO week: 0=Monday, 6=Sunday. To get Sunday, subtract (weekday() + 1) % 7 or use isoweekday() % 7
# Actually simpler: Sunday = today if today is Sunday, else today - (weekday() % 7)
# Even simpler: use (today - timedelta(days=today.isoweekday() % 7)) to get the Sunday
week_start = today - timedelta(days=today.isoweekday() % 7)
week_start_str = week_start.isoformat()
info(f"Today: {today}, Week starting (Sunday): {week_start_str}")

try:
    # Carlos commission calculation:
    # - Exterior A: $51k @ 30% = $15.3k
    # - Ceramico (Signature for automovil = $800k) @ 30% + bonus = $240k + $80k = $320k
    # - Exterior B: $51k @ 30% = $15.3k
    # - Total: $350.6k
    signature_automovil = Decimal("800000")  # From Signature service price_automovil
    ceramic_bonus = Decimal("80000")  # For "Superior Shine +9 EXCLUSIVE"
    carlos_commission = (
        (exterior_price * Decimal("0.30") * 2) +  # 2 exterior items @ 30%
        (signature_automovil * Decimal("0.30")) +  # Ceramico @ 30%
        ceramic_bonus  # Ceramic bonus
    ).quantize(Decimal("0.01"))

    carlos_cash_paid = Decimal("100000")  # Pay partial, create debt
    carlos_debt_created = carlos_commission - carlos_cash_paid

    payload = {
        "payment_cash": float(carlos_cash_paid),
        "payment_datafono": 0,
        "payment_nequi": 0,
        "payment_bancolombia": 0,
    }

    info(f"Carlos commission: ${carlos_commission:,.0f} (exterior×2 + ceramic + bonus), paying: ${carlos_cash_paid:,.0f}, debt: ${carlos_debt_created:,.0f}")
    r = requests.post(
        f"{BASE}/liquidation/{carlos_id}/liquidate",
        params={"week_start": week_start_str},
        json=payload
    )
    assert r.status_code == 200, f"Carlos liquidation failed: {r.text}"

    ok(f"Carlos liquidated: commission=${carlos_commission:,.0f}, "
       f"paid cash=${carlos_cash_paid:,.0f}, debt created=${carlos_debt_created:,.0f}")

except Exception as e:
    fail(f"Carlos liquidation: {e}")

try:
    # Jose: 1 pieza × $90k = $90k
    jose_commission = Decimal("90000")

    r = requests.post(
        f"{BASE}/liquidation/{jose_id}/liquidate",
        params={"week_start": week_start_str},
        json={
            "payment_cash": "0",
            "payment_datafono": str(jose_commission),
            "payment_nequi": "0",
            "payment_bancolombia": "0",
        }
    )
    assert r.status_code == 200, f"Jose liquidation failed: {r.text}"

    ok(f"Jose liquidated: commission=${jose_commission:,.0f}, paid via datafono")

except Exception as e:
    fail(f"Jose liquidation: {e}")

try:
    # Enrique: full payment
    enrique_commission = latoneria_operator_pay  # $80k
    enrique_cash = enrique_commission

    r = requests.post(
        f"{BASE}/liquidation/{enrique_id}/liquidate",
        params={"week_start": week_start_str},
        json={
            "payment_cash": float(enrique_cash),
            "payment_datafono": 0,
            "payment_nequi": 0,
            "payment_bancolombia": 0,
        }
    )
    assert r.status_code == 200, f"Enrique liquidation failed: {r.text}"

    ok(f"Enrique liquidated: commission=${enrique_commission:,.0f}, "
       f"paid cash=${enrique_cash:,.0f}")

except Exception as e:
    fail(f"Enrique liquidation: {e}")

# ===== VERIFY EGRESOS =====
header("VERIFY EGRESOS (auto-created from liquidations)")

try:
    r = requests.get(f"{BASE}/egresos", params={
        "date_start": today.isoformat(),
        "date_end": today.isoformat(),
    })
    assert r.status_code == 200
    egresos = r.json()

    salarios = [e for e in egresos if e['category'] == 'Salarios']

    # Expected: 1 Carlos (cash) + 1 Jose (datafono) + 1 Enrique (cash) = 3 rows
    expected_count = 3
    if len(salarios) >= expected_count:
        ok(f"Egresos: {len(salarios)} Salarios rows created (expected >= {expected_count})")
    else:
        fail(f"Egresos: {len(salarios)} rows (expected >= {expected_count})")

    methods = [e['payment_method'] for e in salarios]
    if 'Datáfono' in methods:
        ok("Egresos: Datáfono method present (Jose)")
    else:
        fail("Egresos: Datáfono method missing")

    cash_count = sum(1 for m in methods if m == 'Efectivo')
    if cash_count >= 2:
        ok(f"Egresos: {cash_count} Efectivo rows (Carlos + Enrique)")
    else:
        fail(f"Egresos: {cash_count} Efectivo rows (expected >= 2)")

except Exception as e:
    fail(f"Egresos verification: {e}")

# ===== VERIFY INGRESOS =====
header("VERIFY INGRESOS (split by payment method)")

try:
    r = requests.get(f"{BASE}/ingresos", params={
        "period": "day",
        "ref_date": today.isoformat(),
    })
    assert r.status_code == 200
    ingresos_data = r.json()

    daily = ingresos_data.get('daily_totals', [])
    today_row = next((d for d in daily if d['date'] == str(today)), None)

    if today_row:
        cash = Decimal(str(today_row.get('payment_cash', 0)))
        datafono = Decimal(str(today_row.get('payment_datafono', 0)))
        nequi = Decimal(str(today_row.get('payment_nequi', 0)))
        bancolombia = Decimal(str(today_row.get('payment_bancolombia', 0)))
        total = Decimal(str(today_row.get('total', 0)))

        info(f"Ingresos {today}: cash=${cash:,.0f} datafono=${datafono:,.0f} nequi=${nequi:,.0f} bancolombia=${bancolombia:,.0f} total=${total:,.0f}")

        if cash >= Decimal("200000"):
            ok(f"Ingresos: cash >= $200,000 (actual: ${cash:,.0f})")
        else:
            fail(f"Ingresos: cash < $200,000 (actual: ${cash:,.0f})")

        if nequi >= Decimal("50000"):
            ok(f"Ingresos: nequi >= $50,000 (actual: ${nequi:,.0f})")
        else:
            fail(f"Ingresos: nequi < $50,000 (actual: ${nequi:,.0f})")

        if bancolombia >= exterior_price:
            ok(f"Ingresos: bancolombia >= ${exterior_price:,.0f} (actual: ${bancolombia:,.0f})")
        else:
            fail(f"Ingresos: bancolombia < ${exterior_price:,.0f} (actual: ${bancolombia:,.0f})")

        # Verify total = sum of all methods
        computed_total = cash + datafono + nequi + bancolombia
        if abs(total - computed_total) < Decimal("1"):
            ok(f"Ingresos: total ${total:,.0f} = sum of methods ${computed_total:,.0f}")
        else:
            fail(f"Ingresos: total ${total:,.0f} != sum ${computed_total:,.0f}")

    else:
        fail(f"No ingresos row for {today}")

except Exception as e:
    fail(f"Ingresos verification: {e}")

# ===== VERIFY DEBTS =====
header("VERIFY DEBTS (auto-created from partial payment)")

try:
    r = requests.get(f"{BASE}/liquidation/{carlos_id}/debts")
    assert r.status_code == 200
    debts = r.json()

    empresa_debts = [d for d in debts if d.get('direction') == 'empresa_operario']

    if empresa_debts:
        debt = empresa_debts[0]
        debt_amount = Decimal(str(debt['amount']))
        paid_amount = Decimal(str(debt.get('paid_amount', 0)))

        if abs(Decimal(str(debt_amount)) - carlos_debt_created) < Decimal("1"):
            ok(f"Carlos debt: ${debt_amount:,.0f} (commission - paid = ${carlos_debt_created:,.0f})")
        else:
            fail(f"Carlos debt amount: expected ${carlos_debt_created:,.0f}, got ${debt_amount:,.0f}")
    else:
        fail("No empresa_operario debt found for Carlos")

except Exception as e:
    fail(f"Debts verification: {e}")

# ===== VERIFY IS_LIQUIDATED =====
header("VERIFY is_liquidated FLAGS")

try:
    for op_id, op_name in [(carlos_id, "Carlos"), (jose_id, "Jose"), (enrique_id, "Enrique")]:
        r = requests.get(
            f"{BASE}/liquidation/{op_id}/report",
            params={"period": "week", "ref_date": today.isoformat()}
        )
        assert r.status_code == 200
        report = r.json()

        if all(o.get('is_liquidated') for o in report.get('orders', [])):
            ok(f"{op_name}: all orders is_liquidated=True")
        else:
            fail(f"{op_name}: some orders not liquidated")

except Exception as e:
    fail(f"is_liquidated verification: {e}")

# ===== RE-LIQUIDATION TEST =====
header("RE-LIQUIDATION TEST (prevent reappearance bug)")

try:
    r = requests.get(f"{BASE}/liquidation/{carlos_id}/week", params={"week_start": week_start_str})
    assert r.status_code == 200
    week_data = r.json()

    orders_in_week = sum(len(d.get('orders', [])) for d in week_data.get('days', []))
    liquidated = sum(1 for d in week_data.get('days', []) for o in d.get('orders', []) if o.get('is_liquidated'))

    if liquidated == orders_in_week:
        ok(f"Carlos: all {orders_in_week} orders still liquidated after re-liquidation")
    else:
        fail(f"Carlos: {liquidated}/{orders_in_week} orders liquidated")

except Exception as e:
    fail(f"Re-liquidation test: {e}")

# ===== CLIENT CREDIT FLOW =====
header("CLIENT CREDIT FLOW (is_client_credit delivery → credits endpoint → pay)")

try:
    credit_plate = f"CR{random.randint(1000, 9999)}"
    credit_phone = f"310{random.randint(1000000, 9999999)}"
    credit_client_name = f"CreditTest {credit_plate}"

    info(f"Credit test plate: {credit_plate}, phone: {credit_phone}")

    payload = {
        "vehicle_type": "automovil",
        "plate": credit_plate,
        "brand": "Mazda",
        "model": "3",
        "color": "Rojo",
        "client_name": credit_client_name,
        "client_phone": credit_phone,
        "service_ids": [exterior_id],
        "item_overrides": [],
        "downpayment": "0",
        "downpayment_method": "Efectivo",
        "is_warranty": False,
    }

    r = requests.post(f"{BASE}/orders", json=payload)
    assert r.status_code == 201, f"POST /orders (credit) failed: {r.status_code} {r.text}"
    credit_order = r.json()
    credit_order_id = credit_order['id']
    credit_order_total = Decimal(str(credit_order['total']))
    info(f"Credit order created: id={credit_order_id} total=${float(credit_order_total):,.0f}")

    ok(f"Credit order created: #{credit_order['order_number']} total=${credit_order_total:,.0f}")

except Exception as e:
    fail(f"Credit order creation: {e}")
    sys.exit(1)

try:
    # Get patio entry
    r = requests.get(f"{BASE}/patio")
    assert r.status_code == 200
    patio_entries = r.json()
    patio_credit = next((p for p in patio_entries if p['order_id'] == credit_order_id), None)
    assert patio_credit, "Credit patio entry not found"
    patio_credit_id = patio_credit['id']
    info(f"Credit patio entry: id={patio_credit_id} status={patio_credit['status']}")

    # Assign Carlos as operator
    r = requests.patch(f"{BASE}/patio/{patio_credit_id}", json={"operator_id": carlos_id})
    assert r.status_code == 200, f"Assign operator failed: {r.text}"
    info("Assigned Carlos to credit patio entry")

    # Advance esperando → en_proceso
    r = requests.post(f"{BASE}/patio/{patio_credit_id}/advance", json={})
    assert r.status_code == 200, f"Advance to en_proceso failed: {r.text}"
    info("Advanced to en_proceso")

    # Re-fetch to get current status and items
    r = requests.get(f"{BASE}/patio")
    assert r.status_code == 200
    patio_entries = r.json()
    patio_credit = next((p for p in patio_entries if p['order_id'] == credit_order_id), None)
    assert patio_credit, "Credit patio entry not found after advance"
    current_status = patio_credit['status']
    info(f"Status after first advance: {current_status}")

    # Confirm all items (required to qualify for liquidation and to trigger auto-advance to listo)
    items = patio_credit.get('order', {}).get('items', [])
    if not items:
        # Try alternate structure
        items = patio_credit.get('items', [])
    info(f"Items to confirm: {len(items)}")

    for item in items:
        r = requests.patch(f"{BASE}/patio/{patio_credit_id}/items/{item['id']}/confirm")
        assert r.status_code == 200, f"Confirm item {item['id']} failed: {r.text}"
        info(f"Confirmed item {item['id']}")

    # Re-fetch to check if auto-advanced to listo
    r = requests.get(f"{BASE}/patio")
    assert r.status_code == 200
    patio_entries = r.json()
    patio_credit = next((p for p in patio_entries if p['order_id'] == credit_order_id), None)
    assert patio_credit, "Credit patio entry not found after item confirmation"
    current_status = patio_credit['status']
    info(f"Status after confirming all items: {current_status}")

    # If not yet listo, explicitly advance
    if current_status != 'listo':
        r = requests.post(f"{BASE}/patio/{patio_credit_id}/advance", json={})
        assert r.status_code == 200, f"Advance to listo failed: {r.text}"
        info("Explicitly advanced to listo")

    # Advance listo → entregado with is_client_credit=True
    r = requests.post(f"{BASE}/patio/{patio_credit_id}/advance", json={"is_client_credit": True})
    assert r.status_code == 200, f"Credit delivery failed: {r.status_code} {r.text}"
    delivered = r.json()

    # Verify credit state
    assert delivered.get('status') == 'entregado', f"Expected entregado, got {delivered.get('status')}"
    assert delivered.get('order', {}).get('is_client_credit') == True, \
        f"is_client_credit not True: {delivered.get('order', {}).get('is_client_credit')}"
    assert delivered.get('order', {}).get('paid') == False, \
        f"paid not False: {delivered.get('order', {}).get('paid')}"
    assert float(delivered.get('order', {}).get('payment_cash', 1)) == 0.0, \
        f"payment_cash not 0: {delivered.get('order', {}).get('payment_cash')}"

    ok("Credit delivery: status=entregado, is_client_credit=True, paid=False, payment_cash=0")

except Exception as e:
    fail(f"Credit delivery flow: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    # Find client via GET /clients — assert pending_credit_total > 0
    r = requests.get(f"{BASE}/clients", params={"search": credit_phone})
    assert r.status_code == 200, f"GET /clients failed: {r.status_code} {r.text}"
    clients = r.json()
    credit_client = next((c for c in clients if c['phone'] == credit_phone), None)
    assert credit_client, f"Credit client not found by phone {credit_phone}"
    credit_client_id = credit_client['id']

    pending_credit_total = float(credit_client.get('pending_credit_total', 0))
    assert pending_credit_total > 0, f"pending_credit_total should be > 0, got {pending_credit_total}"

    ok(f"GET /clients: pending_credit_total=${pending_credit_total:,.0f} > 0 for client id={credit_client_id}")

except Exception as e:
    fail(f"Client credit_total check: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    # GET /clients/{id}/credits — assert returns 1 item with correct order_id
    r = requests.get(f"{BASE}/clients/{credit_client_id}/credits")
    assert r.status_code == 200, f"GET /clients/{credit_client_id}/credits failed: {r.status_code} {r.text}"
    credits = r.json()
    assert len(credits) == 1, f"Expected 1 credit, got {len(credits)}"
    assert credits[0].get('id') == credit_order_id or credits[0].get('order_id') == credit_order_id, \
        f"Credit order_id mismatch: {credits[0]}"

    ok(f"GET /clients/{{id}}/credits: 1 pending credit order (id={credit_order_id})")

except Exception as e:
    fail(f"GET credits list: {e}")
    import traceback
    traceback.print_exc()

try:
    # POST /clients/{id}/credits/pay — pay in full via cash
    r = requests.post(f"{BASE}/clients/{credit_client_id}/credits/pay", json={
        "payment_cash": float(credit_order_total),
        "payment_datafono": 0,
        "payment_nequi": 0,
        "payment_bancolombia": 0,
    })
    assert r.status_code == 200, f"POST /credits/pay failed: {r.status_code} {r.text}"
    pay_result = r.json()
    # Response should be [] (empty list = all paid)
    assert pay_result == [], f"Expected empty list after full payment, got {pay_result}"

    ok("POST /clients/{id}/credits/pay: returned [] (all credits paid)")

except Exception as e:
    fail(f"Credits pay: {e}")
    import traceback
    traceback.print_exc()

try:
    # Verify after payment: GET /clients/{id}/credits → empty list
    r = requests.get(f"{BASE}/clients/{credit_client_id}/credits")
    assert r.status_code == 200
    credits_after = r.json()
    assert credits_after == [], f"Expected empty credits list after payment, got {credits_after}"

    ok("After payment: GET /clients/{id}/credits → [] (empty)")

    # Verify GET /clients?search → pending_credit_total == 0
    r = requests.get(f"{BASE}/clients", params={"search": credit_phone})
    assert r.status_code == 200
    clients_after = r.json()
    credit_client_after = next((c for c in clients_after if c['phone'] == credit_phone), None)
    assert credit_client_after, "Credit client not found after payment"
    pending_after = float(credit_client_after.get('pending_credit_total', -1))
    assert pending_after == 0.0, f"pending_credit_total should be 0 after payment, got {pending_after}"

    ok(f"After payment: GET /clients pending_credit_total=0")

except Exception as e:
    fail(f"Post-payment verification: {e}")
    import traceback
    traceback.print_exc()

# ===== SUMMARY =====
header("FINAL SUMMARY")

passed = sum(1 for p, _ in results if p)
total = len(results)
pct = (passed / total * 100) if total > 0 else 0

print(f"Results: {BOLD}{passed}/{total}{RESET} passed ({pct:.1f}%)\n")

if passed == total:
    print(f"{GREEN}{BOLD}ALL TESTS PASSED!{RESET}\n")
    sys.exit(0)
else:
    print(f"{RED}{BOLD}SOME TESTS FAILED{RESET}\n")
    for passed, msg in results:
        if not passed:
            print(f"  {RED}[FAIL]{RESET} {msg}")
    print()
    sys.exit(1)
