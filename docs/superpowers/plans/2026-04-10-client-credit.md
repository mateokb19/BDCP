# Client Credit (Deudas de Clientes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an order to be delivered on credit (cliente debe el restante), track pending debt per client, register payment from the Clientes page, and reflect income in Ingresos only once paid.

**Architecture:** Two new columns on `service_orders` (`is_client_credit`, `client_credit_paid_at`). When credit is confirmed, `payment_*` columns stay 0 — so Ingresos already excludes them. When the client pays from Clientes, those columns are filled and income appears automatically at the delivery date. Operators are liquidated as usual from `entregado`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Pydantic v2, React 18 + TypeScript, Tailwind v4, Framer Motion, date-fns v3, sonner (toasts).

---

## File Map

| File | Change |
|---|---|
| `backend/app/main.py` | +2 ALTER TABLE migrations |
| `backend/app/models.py` | +2 columns on `ServiceOrder` |
| `backend/app/schemas.py` | `AdvancePayload.is_client_credit`, `OrderOut` new fields, `ClientOut.pending_credit_total`, new `ClientCreditOut` + `ClientCreditPayment` |
| `backend/app/routers/patio.py` | `advance_status` handles `is_client_credit=True` |
| `backend/app/routers/clients.py` | `_build_client_out` calculates `pending_credit_total`; new `GET /{id}/credits`; new `POST /{id}/credits/pay` |
| `frontend/src/api/index.ts` | `ApiOrder` + `ApiClient` new fields; `ApiClientCredit` type; `api.patio.advance` updated; `api.clients.getCredits` + `payCredits` |
| `frontend/src/app/pages/estadoPatio/DeliveryModal.tsx` | "El cliente debe" button + confirmation sub-state |
| `frontend/src/app/pages/EstadoPatio.tsx` | `confirmCreditDelivery` function; pass `onCreditDelivery` prop |
| `frontend/src/app/pages/Clientes.tsx` | debt badge in `ClientRow`; 4th KPI card; `ClientDrawer` credits section + payment modal; PDF download button |
| `frontend/src/app/pages/clientes/creditInvoiceTemplate.ts` | New file — HTML template for the debt invoice PDF |

---

## Task 1: DB Migrations + Model Columns

**Files:**
- Modify: `backend/app/main.py` (after line 128, before `_conn.commit()`)
- Modify: `backend/app/models.py` (ServiceOrder class)

- [ ] **Step 1: Add migrations to main.py**

Open `backend/app/main.py`. Add these two lines right before `_conn.commit()` on line 144 (after the last existing `_conn.execute` call):

```python
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "
        "is_client_credit BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    _conn.execute(text(
        "ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "
        "client_credit_paid_at TIMESTAMP"
    ))
```

- [ ] **Step 2: Add columns to ServiceOrder model**

Open `backend/app/models.py`. The `ServiceOrder` class currently ends around line 155 with `notes = Column(Text)`. Add these two lines after `notes`:

```python
    is_client_credit        = Column(Boolean, nullable=False, default=False)
    client_credit_paid_at   = Column(DateTime, nullable=True)
```

- [ ] **Step 3: Restart backend to run migrations**

```bash
docker compose restart backend
docker compose logs -f backend
```

Expected: no errors, backend starts up with the new columns applied.

- [ ] **Step 4: Verify columns exist in DB**

```bash
docker compose exec db psql -U postgres -d bdcpolo -c "\d service_orders" | grep client_credit
```

Expected output (two lines):
```
 is_client_credit        | boolean                     | not null default false
 client_credit_paid_at   | timestamp without time zone |
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/app/models.py
git commit -m "feat: add is_client_credit + client_credit_paid_at to service_orders"
```

---

## Task 2: Backend Schemas

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Add `is_client_credit` to `AdvancePayload`**

Find `AdvancePayload` (around line 219). Add one field:

```python
class AdvancePayload(BaseModel):
    payment_cash:        Decimal = Decimal("0")
    payment_datafono:    Decimal = Decimal("0")
    payment_nequi:       Decimal = Decimal("0")
    payment_bancolombia: Decimal = Decimal("0")
    latoneria_operator_pay: Optional[Decimal] = None
    is_client_credit:    bool    = False
```

- [ ] **Step 2: Add `is_client_credit` + `client_credit_paid_at` to `OrderOut`**

Find `OrderOut` (around line 180). Add two fields after `payment_bancolombia`:

```python
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
    is_client_credit:       bool              = False
    client_credit_paid_at:  Optional[datetime] = None
    latoneria_operator_pay: Optional[Decimal] = None
    items:               list[OrderItemOut]
```

- [ ] **Step 3: Add `pending_credit_total` to `ClientOut`**

Find `ClientOut` (around line 546). Add `pending_credit_total` after `last_service`:

```python
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
    pending_credit_total: Decimal                = Decimal("0")
```

- [ ] **Step 4: Add `ClientCreditOut` and `ClientCreditPayment` schemas**

Add these two new classes right after `ClientPatch` (around line 572), before the `# ── Ingresos` section:

```python
class ClientCreditOut(BaseModel):
    order_id:     int
    order_number: str
    delivered_at: str
    plate:        str
    vehicle:      str   # "brand model"
    services:     str   # service names joined by ", "
    amount:       float  # restante = total - downpayment


class ClientCreditPayment(BaseModel):
    payment_cash:        Decimal = Decimal("0")
    payment_datafono:    Decimal = Decimal("0")
    payment_nequi:       Decimal = Decimal("0")
    payment_bancolombia: Decimal = Decimal("0")
```

- [ ] **Step 5: Restart backend and verify no import errors**

```bash
docker compose restart backend && docker compose logs backend | grep -E "ERROR|started"
```

Expected: `Application startup complete.`

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add client credit schemas (AdvancePayload, OrderOut, ClientOut, ClientCreditOut)"
```

---

## Task 3: Patio Advance Endpoint — Credit Support

**Files:**
- Modify: `backend/app/routers/patio.py` (lines 79–86)

- [ ] **Step 1: Update the `entregado` branch in `advance_status`**

Find the `elif next_status == models.PatioStatusEnum.entregado:` block (around line 79). Replace it:

```python
    elif next_status == models.PatioStatusEnum.entregado:
        entry.delivered_at = now
        entry.order.status = models.OrderStatusEnum.entregado
        if payload.is_client_credit:
            # Client owes the restante — payment recorded later from Clientes page
            entry.order.is_client_credit     = True
            entry.order.payment_cash         = 0
            entry.order.payment_datafono     = 0
            entry.order.payment_nequi        = 0
            entry.order.payment_bancolombia  = 0
            entry.order.paid                 = False
        else:
            entry.order.payment_cash         = payload.payment_cash
            entry.order.payment_datafono     = payload.payment_datafono
            entry.order.payment_nequi        = payload.payment_nequi
            entry.order.payment_bancolombia  = payload.payment_bancolombia
            entry.order.paid                 = True
```

- [ ] **Step 2: Restart backend**

```bash
docker compose restart backend && docker compose logs backend | grep -E "ERROR|started"
```

Expected: `Application startup complete.`

- [ ] **Step 3: Smoke-test via curl — credit delivery**

First find a patio entry in `listo` status using the Swagger UI at http://localhost:28000/docs, or use:

```bash
curl -s http://localhost:28000/api/v1/patio | python3 -c "
import sys, json
entries = json.load(sys.stdin)
listo = [e for e in entries if e['status'] == 'listo']
print('listo entries:', [(e['id'], e['vehicle']['plate']) for e in listo])
"
```

Then advance one to entregado as credit (replace `<ID>` with a real listo entry id):

```bash
curl -s -X POST http://localhost:28000/api/v1/patio/<ID>/advance \
  -H "Content-Type: application/json" \
  -d '{"is_client_credit": true}' | python3 -c "
import sys, json
r = json.load(sys.stdin)
o = r['order']
print('status:', r['status'])
print('is_client_credit:', o['is_client_credit'])
print('paid:', o['paid'])
print('payment_cash:', o['payment_cash'])
"
```

Expected:
```
status: entregado
is_client_credit: True
paid: False
payment_cash: 0
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/patio.py
git commit -m "feat: patio advance supports is_client_credit flag"
```

---

## Task 4: Clients Router — Credits Endpoints

**Files:**
- Modify: `backend/app/routers/clients.py`

- [ ] **Step 1: Add `pending_credit_total` to `_build_client_out`**

Open `backend/app/routers/clients.py`. Find `_build_client_out` (line 11). Replace the function:

```python
def _build_client_out(c: models.Client) -> schemas.ClientOut:
    order_count           = 0
    total_spent           = Decimal("0")
    last_service          = None
    pending_credit_total  = Decimal("0")
    for v in c.vehicles:
        for o in v.orders:
            if o.status != "cancelado":
                order_count += 1
                total_spent += Decimal(str(o.total))
                if last_service is None or o.date > last_service:
                    last_service = o.date
            if o.is_client_credit and o.client_credit_paid_at is None:
                pending_credit_total += Decimal(str(o.total)) - Decimal(str(o.downpayment))
    return schemas.ClientOut(
        id=c.id,
        name=c.name,
        phone=c.phone,
        email=c.email,
        tipo_persona=c.tipo_persona,
        tipo_identificacion=c.tipo_identificacion,
        identificacion=c.identificacion,
        dv=c.dv,
        notes=c.notes,
        created_at=c.created_at,
        vehicles=[schemas.ClientVehicleOut.model_validate(v) for v in c.vehicles],
        order_count=order_count,
        total_spent=total_spent,
        last_service=last_service,
        pending_credit_total=pending_credit_total,
    )
```

- [ ] **Step 2: Add `GET /{client_id}/credits` endpoint**

Add this function after the `patch_client` function at the end of the file:

```python
@router.get("/{client_id}/credits", response_model=list[schemas.ClientCreditOut])
def list_client_credits(client_id: int, db: Session = Depends(get_db)):
    """List all pending (unpaid) credit orders for a client."""
    c = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    results = []
    for v in c.vehicles:
        for o in v.orders:
            if not o.is_client_credit or o.client_credit_paid_at is not None:
                continue
            # Find delivered_at from patio entry
            delivered_at = "—"
            if o.patio_entry and o.patio_entry.delivered_at:
                delivered_at = str(o.patio_entry.delivered_at.date())
            brand_model = f"{v.brand or ''} {v.model or ''}".strip() or v.plate
            services = ", ".join(i.service_name for i in o.items)
            amount = float(Decimal(str(o.total)) - Decimal(str(o.downpayment)))
            results.append(schemas.ClientCreditOut(
                order_id=o.id,
                order_number=o.order_number or f"#{o.id}",
                delivered_at=delivered_at,
                plate=v.plate,
                vehicle=brand_model,
                services=services,
                amount=amount,
            ))
    results.sort(key=lambda x: x.delivered_at)
    return results
```

Note: this function needs `Decimal` imported. Add `from decimal import Decimal` to the imports at the top of `clients.py`.

- [ ] **Step 3: Add `POST /{client_id}/credits/pay` endpoint**

Add this function at the end of the file, right after `list_client_credits`:

```python
@router.post("/{client_id}/credits/pay", response_model=list[schemas.ClientCreditOut])
def pay_client_credits(
    client_id: int,
    data: schemas.ClientCreditPayment,
    db: Session = Depends(get_db),
):
    """
    Record payment for all pending credit orders for a client.
    Payment amounts are distributed proportionally by order weight.
    Returns empty list when all debts are paid.
    """
    from app.tz import now_bogota

    c = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Collect pending credit orders across all vehicles
    pending: list[tuple[models.ServiceOrder, Decimal]] = []
    for v in c.vehicles:
        for o in v.orders:
            if o.is_client_credit and o.client_credit_paid_at is None:
                amount = Decimal(str(o.total)) - Decimal(str(o.downpayment))
                if amount > 0:
                    pending.append((o, amount))

    if not pending:
        return []

    total_debt = sum(amt for _, amt in pending)
    total_paid = (
        Decimal(str(data.payment_cash)) +
        Decimal(str(data.payment_datafono)) +
        Decimal(str(data.payment_nequi)) +
        Decimal(str(data.payment_bancolombia))
    )

    if total_paid <= 0:
        raise HTTPException(status_code=400, detail="El monto pagado debe ser mayor a 0")
    if total_paid > total_debt:
        raise HTTPException(
            status_code=400,
            detail=f"El pago (${total_paid:,.0f}) supera la deuda total (${total_debt:,.0f})"
        )

    now = now_bogota()

    for order, order_amt in pending:
        weight = order_amt / total_debt
        order.payment_cash        = (Decimal(str(data.payment_cash))        * weight).quantize(Decimal("0.01"))
        order.payment_datafono    = (Decimal(str(data.payment_datafono))    * weight).quantize(Decimal("0.01"))
        order.payment_nequi       = (Decimal(str(data.payment_nequi))       * weight).quantize(Decimal("0.01"))
        order.payment_bancolombia = (Decimal(str(data.payment_bancolombia)) * weight).quantize(Decimal("0.01"))
        order.paid                = True
        order.client_credit_paid_at = now

    db.commit()
    return []   # all debts now paid — frontend clears the section
```

- [ ] **Step 4: Ensure `patio_entry` relationship is loaded in clients query**

The `list_client_credits` function accesses `o.patio_entry.delivered_at`. The existing `list_clients` query loads vehicles and orders but not patio entries. Open `backend/app/routers/clients.py`, find `list_clients` (around line 41), and update the query to also eagerly load patio entries:

```python
@router.get("", response_model=list[schemas.ClientOut])
def list_clients(search: Optional[str] = None, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    q = db.query(models.Client).options(
        joinedload(models.Client.vehicles)
        .joinedload(models.Vehicle.orders)
        .joinedload(models.ServiceOrder.patio_entry),
        joinedload(models.Client.vehicles)
        .joinedload(models.Vehicle.orders)
        .joinedload(models.ServiceOrder.items),
    )
    if search:
        term = f"%{search}%"
        q = q.filter(
            models.Client.name.ilike(term) |
            models.Client.phone.ilike(term) |
            models.Client.vehicles.any(models.Vehicle.plate.ilike(term))
        )
    clients = q.order_by(models.Client.name).all()
    return [_build_client_out(c) for c in clients]
```

Also update `patch_client` to pass `joinedload` options when refreshing:

```python
@router.patch("/{client_id}", response_model=schemas.ClientOut)
def patch_client(client_id: int, data: schemas.ClientPatch, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    c = (
        db.query(models.Client)
        .options(
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.patio_entry),
            joinedload(models.Client.vehicles)
            .joinedload(models.Vehicle.orders)
            .joinedload(models.ServiceOrder.items),
        )
        .filter(models.Client.id == client_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if data.name                is not None: c.name                = data.name
    if data.phone               is not None: c.phone               = data.phone
    if data.email               is not None: c.email               = data.email
    if data.tipo_persona        is not None: c.tipo_persona        = data.tipo_persona
    if data.tipo_identificacion is not None: c.tipo_identificacion = data.tipo_identificacion
    if data.identificacion      is not None: c.identificacion      = data.identificacion
    if data.dv                  is not None: c.dv                  = data.dv
    if data.notes               is not None: c.notes               = data.notes
    db.commit()
    db.refresh(c)
    return _build_client_out(c)
```

- [ ] **Step 5: Check `ServiceOrder.patio_entry` relationship exists in models.py**

```bash
grep -n "patio_entry" backend/app/models.py
```

Expected: a `relationship` line pointing to `PatioEntry`. If the back-reference is missing, add to `ServiceOrder`:

```python
patio_entry = relationship("PatioEntry", back_populates="order", uselist=False)
```

And ensure `PatioEntry` has `order = relationship("ServiceOrder", back_populates="patio_entry")`.

- [ ] **Step 6: Restart backend and smoke-test**

```bash
docker compose restart backend && docker compose logs backend | grep -E "ERROR|started"
```

Then test the credits endpoint:

```bash
curl -s http://localhost:28000/api/v1/clients/1/credits
```

Expected: `[]` or a list of `ClientCreditOut` objects.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/clients.py
git commit -m "feat: clients router — pending_credit_total, GET/POST credits endpoints"
```

---

## Task 5: Frontend — Types and API Client

**Files:**
- Modify: `frontend/src/api/index.ts`

- [ ] **Step 1: Add `is_client_credit` and `client_credit_paid_at` to `ApiOrder`**

Find `ApiOrder` (around line 59). Add two fields after `payment_bancolombia`:

```typescript
export interface ApiOrder {
  id: number
  order_number: string
  date: string
  vehicle_id: number
  operator_id?: number
  status: string
  subtotal: number
  total: number
  paid: boolean
  downpayment: string
  is_warranty: boolean
  payment_cash: string
  payment_datafono: string
  payment_nequi: string
  payment_bancolombia: string
  is_client_credit: boolean
  client_credit_paid_at?: string
  latoneria_operator_pay?: string
  items: ApiOrderItem[]
}
```

- [ ] **Step 2: Add `pending_credit_total` to `ApiClient`**

Find `ApiClient` (around line 463). Add one field after `last_service`:

```typescript
export interface ApiClient {
  id:                   number
  name:                 string
  phone?:               string
  email?:               string
  tipo_persona?:        string
  tipo_identificacion?: string
  identificacion?:      string
  dv?:                  string
  notes?:               string
  created_at:           string
  vehicles:             ApiClientVehicle[]
  order_count:          number
  total_spent:          string
  last_service?:        string
  pending_credit_total: string
}
```

- [ ] **Step 3: Add `ApiClientCredit` interface**

Add this interface after `ApiClient` (after the closing brace, before `ClientPatchPayload`):

```typescript
export interface ApiClientCredit {
  order_id:     number
  order_number: string
  delivered_at: string
  plate:        string
  vehicle:      string
  services:     string
  amount:       number
}

export interface ClientCreditPaymentPayload {
  payment_cash:        number
  payment_datafono:    number
  payment_nequi:       number
  payment_bancolombia: number
}
```

- [ ] **Step 4: Update `api.patio.advance` to accept `is_client_credit`**

Find `api.patio.advance` (around line 515). Update its signature:

```typescript
  patio: {
    list: () => apiFetch<ApiPatioEntry[]>('/patio'),
    advance: (
      id: number,
      payload?: {
        payment_cash?: number
        payment_datafono?: number
        payment_nequi?: number
        payment_bancolombia?: number
        latoneria_operator_pay?: number
        is_client_credit?: boolean
      }
    ) =>
      apiFetch<ApiPatioEntry>(`/patio/${id}/advance`, { method: 'POST', body: JSON.stringify(payload ?? {}) }),
    edit: (id: number, payload: PatioPatchPayload) =>
      apiFetch<ApiPatioEntry>(`/patio/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    cancel: (id: number) =>
      apiFetch<void>(`/patio/${id}`, { method: 'DELETE' }),
    confirmItem: (entryId: number, itemId: number) =>
      apiFetch<ApiPatioEntry>(`/patio/${entryId}/items/${itemId}/confirm`, { method: 'PATCH' }),
  },
```

- [ ] **Step 5: Add `api.clients.getCredits` and `api.clients.payCredits`**

Find the `clients` section in the `api` object (near the bottom of the file). It currently has `list` and `patch`. Add the two new methods:

```typescript
  clients: {
    list: (search?: string) =>
      apiFetch<ApiClient[]>(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    patch: (id: number, payload: ClientPatchPayload) =>
      apiFetch<ApiClient>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    getCredits: (id: number) =>
      apiFetch<ApiClientCredit[]>(`/clients/${id}/credits`),
    payCredits: (id: number, payload: ClientCreditPaymentPayload) =>
      apiFetch<ApiClientCredit[]>(`/clients/${id}/credits/pay`, { method: 'POST', body: JSON.stringify(payload) }),
  },
```

- [ ] **Step 6: Verify frontend compiles**

```bash
docker compose logs -f frontend
```

Expected: no TypeScript errors. If running outside Docker:

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/index.ts
git commit -m "feat: api client — ApiOrder credit fields, ApiClientCredit type, credit endpoints"
```

---

## Task 6: EstadoPatio — "El cliente debe" Button in DeliveryModal

**Files:**
- Modify: `frontend/src/app/pages/estadoPatio/DeliveryModal.tsx`
- Modify: `frontend/src/app/pages/EstadoPatio.tsx`

### Part A: DeliveryModal

- [ ] **Step 1: Add `onCreditDelivery` prop to `DeliveryModalProps`**

Open `frontend/src/app/pages/estadoPatio/DeliveryModal.tsx`. Add `onCreditDelivery` to the interface (line 28, after `onConfirm`):

```typescript
interface DeliveryModalProps {
  paymentEntry:    ApiPatioEntry
  onClose:         () => void
  payMethods:      Record<string, string>
  setPayMethods:   React.Dispatch<React.SetStateAction<Record<string, string>>>
  togglePayMethod: (key: string) => void
  delivering:      boolean
  applyIva:        boolean
  setApplyIva:     React.Dispatch<React.SetStateAction<boolean>>
  deliveryOpId:    string
  setDeliveryOpId: (id: string) => void
  deliveryOps:     Operators
  factura:         boolean
  setFactura:      React.Dispatch<React.SetStateAction<boolean>>
  facturaData:     FacturaRecord
  setFacturaData:  React.Dispatch<React.SetStateAction<FacturaRecord>>
  onConfirm:       () => Promise<void>
  onCreditDelivery: () => Promise<void>
}
```

- [ ] **Step 2: Add `creditConfirm` local state and destructure `onCreditDelivery`**

In the `DeliveryModal` function body, after the existing computed values (line ~58), add:

```typescript
  const [creditConfirm, setCreditConfirm] = React.useState(false)
```

And add `onCreditDelivery` to the destructured props in the function signature:

```typescript
export function DeliveryModal({
  paymentEntry, onClose,
  payMethods, setPayMethods, togglePayMethod,
  delivering,
  applyIva, setApplyIva,
  deliveryOpId, setDeliveryOpId, deliveryOps,
  factura, setFactura, facturaData, setFacturaData,
  onConfirm,
  onCreditDelivery,
}: DeliveryModalProps) {
```

Also add `import React from 'react'` at the top if not already present (check existing imports — it may already be imported via JSX transform; if so, add `useState` to the import from 'react' or use the `React.useState` pattern after adding `import React from 'react'`).

Actually, the file uses JSX so React is likely already in scope. Add `useState` to imports. At the top of the file (line 1 area), add:

```typescript
import { useState } from 'react'
```

Then change `const [creditConfirm, setCreditConfirm] = React.useState(false)` to:

```typescript
  const [creditConfirm, setCreditConfirm] = useState(false)
```

- [ ] **Step 3: Add the "El cliente debe" button below the payment method checkboxes**

Find the closing `</>` of the payment methods section (after the balance indicator `isMulti` block, around line 210). Insert the credit button **after** the balance indicator block and **before** the closing `</>`:

```tsx
        {/* Credit delivery button */}
        {!creditConfirm ? (
          <button
            type="button"
            onClick={() => setCreditConfirm(true)}
            className="w-full text-left text-xs text-gray-500 hover:text-orange-400 transition-colors py-1 underline underline-offset-2"
          >
            El cliente debe este valor
          </button>
        ) : (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 space-y-3">
            <p className="text-sm text-orange-300 font-medium">
              ¿Confirmar que el cliente debe{' '}
              <span className="font-bold">${restante.toLocaleString('es-CO')}</span>?
            </p>
            <p className="text-xs text-orange-400/70">El vehículo saldrá del patio normalmente.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreditConfirm(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-gray-400 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onCreditDelivery}
                disabled={delivering}
                className="flex-1 rounded-xl border border-orange-500/40 bg-orange-500/20 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
              >
                {delivering ? 'Procesando...' : 'Confirmar deuda'}
              </button>
            </div>
          </div>
        )}
```

The final structure inside `{effectiveRestante > 0 && ( <> ... </> )}` is:
1. Payment method checkboxes
2. Balance indicator (isMulti)
3. NEW: credit button / confirmation

- [ ] **Step 4: Reset `creditConfirm` when modal closes**

The modal closes via `onClose`. When the user clicks Cancelar (the main button), add a side-effect to reset. Since `onClose` is called from the parent, the simplest approach is to reset `creditConfirm` when the component remounts. Add a `useEffect`:

```typescript
  useEffect(() => {
    setCreditConfirm(false)
  }, [paymentEntry.id])
```

Add `useEffect` to the import at the top:
```typescript
import { useState, useEffect } from 'react'
```

### Part B: EstadoPatio.tsx

- [ ] **Step 5: Add `confirmCreditDelivery` function in EstadoPatio.tsx**

Open `frontend/src/app/pages/EstadoPatio.tsx`. Find `confirmDelivery` (around line 281). Add this new function right after it (before `confirmAdvanceWithOperator`):

```typescript
  async function confirmCreditDelivery() {
    if (!paymentEntry) return
    setDelivering(true)
    try {
      if (deliveryOpId) {
        await api.patio.edit(paymentEntry.id, { operator_id: Number(deliveryOpId) })
      }
      const updated = await api.patio.advance(paymentEntry.id, { is_client_credit: true })
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} entregado — cliente debe el restante`)
      setPaymentEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al entregar')
    } finally {
      setDelivering(false)
    }
  }
```

- [ ] **Step 6: Pass `onCreditDelivery` to `DeliveryModal`**

Find the `<DeliveryModal` JSX (around line 483). Add the new prop:

```tsx
          <DeliveryModal
            paymentEntry={paymentEntry}
            onClose={() => setPaymentEntry(null)}
            payMethods={payMethods}
            setPayMethods={setPayMethods}
            togglePayMethod={togglePayMethod}
            delivering={delivering}
            applyIva={applyIva}
            setApplyIva={setApplyIva}
            deliveryOpId={deliveryOpId}
            setDeliveryOpId={setDeliveryOpId}
            deliveryOps={deliveryOps}
            factura={factura}
            setFactura={setFactura}
            facturaData={facturaData}
            setFacturaData={setFacturaData}
            onConfirm={confirmDelivery}
            onCreditDelivery={confirmCreditDelivery}
          />
```

- [ ] **Step 7: Verify frontend compiles and test manually**

```bash
docker compose logs -f frontend
```

In the browser at http://localhost:28001/patio:
1. Move a vehicle to `listo`
2. Click advance button on the card
3. The payment modal opens
4. You should see the small "El cliente debe este valor" text link below the payment checkboxes
5. Click it → orange confirmation panel appears
6. Click "Confirmar deuda" → vehicle disappears from kanban, toast shows the credit message

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/pages/estadoPatio/DeliveryModal.tsx frontend/src/app/pages/EstadoPatio.tsx
git commit -m "feat: delivery modal — credit delivery option with confirmation step"
```

---

## Task 7: Clientes Page — Debt Badge, KPI, Drawer Section, Payment Modal, PDF

**Files:**
- Create: `frontend/src/app/pages/clientes/creditInvoiceTemplate.ts`
- Modify: `frontend/src/app/pages/Clientes.tsx`

### Part A: PDF Template

- [ ] **Step 1: Create the directory and template file**

```bash
mkdir -p frontend/src/app/pages/clientes
```

Create `frontend/src/app/pages/clientes/creditInvoiceTemplate.ts`:

```typescript
import type { ApiClient, ApiClientCredit } from '@/api'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtCOP(n: number): string {
  return Number(n).toLocaleString('es-CO')
}

export function buildCreditInvoiceHtml(
  client: ApiClient,
  credits: ApiClientCredit[],
  generatedAt: string,
): string {
  const total = credits.reduce((s, c) => s + c.amount, 0)

  const rows = credits
    .map(c => `
      <tr>
        <td>${escapeHtml(c.order_number)}</td>
        <td>${escapeHtml(c.delivered_at)}</td>
        <td>${escapeHtml(c.plate)}</td>
        <td>${escapeHtml(c.vehicle)}</td>
        <td class="services">${escapeHtml(c.services)}</td>
        <td class="amount">$${fmtCOP(c.amount)}</td>
      </tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura de Servicios Pendientes — ${escapeHtml(client.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .header .brand { font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .header .brand span { color: #ca8a04; }
    .header .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
    .header .meta strong { font-size: 13px; color: #111; }
    .divider { border: none; border-top: 2px solid #ca8a04; margin: 16px 0; }
    .client-section { margin-bottom: 20px; }
    .client-section p { line-height: 1.8; }
    .client-section .label { font-weight: 600; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; color: #444; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.amount { text-align: right; white-space: nowrap; font-weight: 600; }
    td.services { color: #555; font-size: 11px; max-width: 200px; }
    .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
    .totals table { width: auto; min-width: 240px; }
    .totals td { font-size: 13px; padding: 4px 10px; border: none; }
    .totals .total-row td { font-size: 15px; font-weight: 700; border-top: 2px solid #ca8a04; padding-top: 8px; }
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; }
  </style>
</head>
<body onload="window.print()">
  <div class="header">
    <div class="brand">BDC<span>Polo</span></div>
    <div class="meta">
      <strong>Factura de Servicios Pendientes</strong><br/>
      Generado: ${escapeHtml(generatedAt)}<br/>
      Bogotá Detailing Center
    </div>
  </div>
  <hr class="divider" />

  <div class="client-section">
    <p><span class="label">Cliente:</span> ${escapeHtml(client.name)}</p>
    ${client.phone ? `<p><span class="label">Teléfono:</span> ${escapeHtml(client.phone)}</p>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Orden</th>
        <th>Fecha entrega</th>
        <th>Placa</th>
        <th>Vehículo</th>
        <th>Servicios</th>
        <th style="text-align:right">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr class="total-row">
        <td>Total a pagar:</td>
        <td class="amount">$${fmtCOP(total)}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Bogotá Detailing Center &nbsp;·&nbsp; BDCPolo &nbsp;·&nbsp; Comprobante interno
  </div>
</body>
</html>`
}
```

### Part B: Clientes.tsx Changes

- [ ] **Step 2: Add imports to Clientes.tsx**

Open `frontend/src/app/pages/Clientes.tsx`. Add the missing imports to the existing import line:

```typescript
import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, X, Pencil, Check, Car, Users, Package, Wrench,
  AlertCircle, Download, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { cn } from '@/app/components/ui/cn'
import { VehicleTypeIcon, vehicleTypeLabel } from '@/app/components/ui/VehicleTypeIcon'
import { api, type ApiClient, type ApiClientVehicle, type ApiClientCredit } from '@/api'
import type { VehicleType } from '@/types'
import { buildCreditInvoiceHtml } from './clientes/creditInvoiceTemplate'
```

Note: `date-fns` is already in the project. `parseISO` and `format` are used to display `delivered_at`.

- [ ] **Step 3: Add the fmtCOP helper and PAYMENT_METHODS constant**

After the existing `formatDate` helper (around line 38), add:

```typescript
function fmtCOP(v: string | number) {
  return Number(v).toLocaleString('es-CO')
}

const CREDIT_METHODS = [
  { key: 'cash',        label: 'Efectivo' },
  { key: 'datafono',    label: 'Banco Caja Social' },
  { key: 'nequi',       label: 'Nequi' },
  { key: 'bancolombia', label: 'Bancolombia Ahorros' },
]
```

- [ ] **Step 4: Add debt badge to `ClientRow`**

Find the `ClientRow` component (around line 86). Add the debt badge inside the name/phone column, after the phone line:

```tsx
      {/* Name + phone + debt badge */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white break-all">{client.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{client.phone ?? '—'}</p>
        {client.identificacion && (
          <p className="text-xs text-blue-400 font-mono mt-0.5">
            {client.tipo_identificacion === 'NIT' ? 'NIT' : 'ID'} {client.identificacion}{client.dv ? `-${client.dv}` : ''}
          </p>
        )}
        {Number(client.pending_credit_total) > 0 && (
          <p className="text-xs text-red-400 font-medium mt-0.5 flex items-center gap-1">
            <AlertCircle size={10} />
            Debe ${fmtCOP(client.pending_credit_total)}
          </p>
        )}
      </div>
```

- [ ] **Step 5: Add "Con deuda" KPI card**

In the main `Clientes` component, add this computed value after `totalServices`:

```typescript
  const totalWithDebt = useMemo(
    () => clients.filter(c => Number(c.pending_credit_total) > 0).length,
    [clients],
  )
```

Then update the KPI grid from `grid-cols-1 sm:grid-cols-3` to `grid-cols-2 sm:grid-cols-4` and add the 4th card:

```tsx
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Clientes"        value={clients.length}  icon={<Users size={18} />}  color="bg-blue-500/15 text-blue-400" />
        <KpiCard label="Vehículos Registrados" value={totalVehicles}   icon={<Car size={18} />}    color="bg-purple-500/15 text-purple-400" />
        <KpiCard label="Servicios Totales"     value={totalServices}   icon={<Wrench size={18} />} color="bg-yellow-500/15 text-yellow-400" />
        <KpiCard label="Con Deuda"             value={totalWithDebt}   icon={<CreditCard size={18} />} color="bg-red-500/15 text-red-400" />
      </div>
```

- [ ] **Step 6: Add credits state and handlers to `ClientDrawer`**

Open the `ClientDrawer` component (around line 139). Add state and fetch logic for credits:

```typescript
function ClientDrawer({ client, onClose, onUpdated }: DrawerProps) {
  const [editing, setEditing] = useState(false)
  // ... existing state ...
  const [saving, setSaving] = useState(false)

  // Credit debt state
  const [credits, setCredits]             = useState<ApiClientCredit[]>([])
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [payModal, setPayModal]           = useState(false)
  const [payMethods, setPayMethods]       = useState<Record<string, string>>({})
  const [paying, setPaying]               = useState(false)
```

Add a `useEffect` to fetch credits when the drawer opens or client changes (put it after the existing `useEffect` that resets the form):

```typescript
  useEffect(() => {
    if (Number(client.pending_credit_total) <= 0) {
      setCredits([])
      return
    }
    setCreditsLoading(true)
    api.clients.getCredits(client.id)
      .then(setCredits)
      .catch(() => toast.error('Error al cargar deudas'))
      .finally(() => setCreditsLoading(false))
  }, [client.id, client.pending_credit_total])
```

- [ ] **Step 7: Add helper functions for the payment modal in `ClientDrawer`**

After the `useEffect` blocks, add:

```typescript
  function togglePayMethod(key: string) {
    setPayMethods(prev => {
      const next = { ...prev }
      if (key in next) delete next[key]
      else next[key] = ''
      return next
    })
  }

  const totalDebt = credits.reduce((s, c) => s + c.amount, 0)

  const checkedKeys   = Object.keys(payMethods)
  const isMulti       = checkedKeys.length > 1
  const coveredAmt    = isMulti
    ? checkedKeys.reduce((s, k) => s + (Number(payMethods[k]) || 0), 0)
    : totalDebt
  const diffAmt       = totalDebt - coveredAmt

  async function handlePayCredits() {
    const keyToField: Record<string, keyof typeof payload> = {
      cash: 'payment_cash', datafono: 'payment_datafono',
      nequi: 'payment_nequi', bancolombia: 'payment_bancolombia',
    }
    const payload = { payment_cash: 0, payment_datafono: 0, payment_nequi: 0, payment_bancolombia: 0 }
    if (checkedKeys.length === 1) {
      payload[keyToField[checkedKeys[0]]] = totalDebt
    } else {
      for (const k of checkedKeys) payload[keyToField[k]] = Number(payMethods[k]) || 0
    }
    setPaying(true)
    try {
      await api.clients.payCredits(client.id, payload)
      toast.success('Pago registrado')
      setPayModal(false)
      setPayMethods({})
      setCredits([])
      // Refresh client to update pending_credit_total badge
      const updated = await api.clients.patch(client.id, {})
      onUpdated({ ...client, ...updated })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar pago')
    } finally {
      setPaying(false)
    }
  }

  function handleDownloadInvoice() {
    if (credits.length === 0) return
    const now = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = buildCreditInvoiceHtml(client, credits, now)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (win) win.focus()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
```

Note: `api.clients.patch(client.id, {})` is used here purely to get a refreshed `ClientOut` with updated `pending_credit_total`. This works because the backend re-calculates it on every `GET /clients` or `PATCH /clients/{id}` call. If a clean refresh is preferred, add `api.clients.list()` and filter by id — but the PATCH with empty body is simpler and sufficient.

- [ ] **Step 8: Add "Deudas pendientes" section to `ClientDrawer` JSX**

Find the closing `</div>` of the "Vehículos" section in `ClientDrawer` (around line 491), then the `</motion.div>` that wraps the drawer content. Insert the credits section **before** the `</motion.div>`:

```tsx
          {/* Deudas pendientes */}
          {(creditsLoading || credits.length > 0 || Number(client.pending_credit_total) > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Deudas pendientes
                </p>
                {credits.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadInvoice}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <Download size={11} />
                      Factura PDF
                    </button>
                  </div>
                )}
              </div>

              {creditsLoading ? (
                <div className="text-xs text-gray-500 animate-pulse">Cargando deudas...</div>
              ) : credits.length === 0 ? (
                <div className="text-xs text-gray-500 italic">Sin deudas pendientes</div>
              ) : (
                <>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-red-500/10">
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Orden</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Entrega</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Placa</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credits.map(c => (
                          <tr key={c.order_id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 text-gray-300 font-mono">{c.order_number}</td>
                            <td className="px-3 py-2 text-gray-400">{c.delivered_at}</td>
                            <td className="px-3 py-2 text-gray-400 font-semibold">{c.plate}</td>
                            <td className="px-3 py-2 text-red-400 text-right font-semibold">${fmtCOP(c.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-red-500/20 bg-red-500/5">
                          <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-300">Total</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-red-400">${fmtCOP(totalDebt)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full bg-red-600/80 hover:bg-red-600 border-red-500/40"
                    onClick={() => { setPayModal(true); setPayMethods({}) }}
                  >
                    Registrar pago
                  </Button>
                </>
              )}
            </div>
          )}
```

- [ ] **Step 9: Add payment modal JSX to `ClientDrawer`**

Inside `ClientDrawer`'s return, after the `<motion.div>` drawer (the overlay/slide panel), add the payment modal using `AnimatePresence`:

```tsx
      {/* Credit payment modal */}
      <AnimatePresence>
        {payModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setPayModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5"
            >
              <div>
                <h3 className="text-base font-semibold text-white">Registrar pago</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {client.name} · Total: <span className="text-red-400 font-semibold">${fmtCOP(totalDebt)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Método de pago</p>
                <div className="space-y-1.5">
                  {CREDIT_METHODS.map(m => {
                    const isChecked = m.key in payMethods
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => togglePayMethod(m.key)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          isChecked
                            ? 'border-yellow-500/60 bg-yellow-500/10'
                            : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                          isChecked ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600'
                        )}>
                          {isChecked && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-gray-900" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4l2.5 2.5L9 1" />
                            </svg>
                          )}
                        </div>
                        <p className={cn('text-sm font-medium flex-1', isChecked ? 'text-yellow-300' : 'text-gray-300')}>
                          {m.label}
                        </p>
                        {isChecked && isMulti && (
                          <input
                            type="text" inputMode="numeric" placeholder="0"
                            value={Number(payMethods[m.key] || '0').toLocaleString('es-CO')}
                            onChange={e => {
                              e.stopPropagation()
                              const raw = e.target.value.replace(/\./g, '').replace(/,/g, '')
                              setPayMethods(prev => ({ ...prev, [m.key]: raw }))
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-right text-gray-100 focus:border-yellow-500/50 focus:outline-none"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {isMulti && (
                <div className={cn(
                  'text-xs text-center rounded-xl px-3 py-2 font-medium',
                  diffAmt === 0 ? 'text-green-400 bg-green-500/10 border border-green-500/20' :
                  diffAmt <  0 ? 'text-blue-400  bg-blue-500/10  border border-blue-500/20'  :
                                 'text-orange-400 bg-orange-500/10 border border-orange-500/20'
                )}>
                  {diffAmt === 0 && '✓ Pago completo'}
                  {diffAmt <  0 && `Cambio al cliente: $${fmtCOP(Math.abs(diffAmt))}`}
                  {diffAmt >  0 && `Pendiente: $${fmtCOP(diffAmt)}`}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => setPayModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={handlePayCredits}
                  disabled={paying || checkedKeys.length === 0 || (isMulti && diffAmt > 0)}
                >
                  {paying ? 'Guardando...' : 'Confirmar pago'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 10: Verify frontend compiles and test manually**

```bash
docker compose logs -f frontend
```

In the browser:
1. Go to `/clientes`
2. A client that had a credit delivery should show the red "Debe $..." badge
3. The 4th KPI card "Con Deuda" shows the count
4. Open the drawer → "Deudas pendientes" section shows with the table
5. Click "Factura PDF" → browser opens print dialog with the invoice
6. Click "Registrar pago" → payment modal opens with the 4 methods
7. Select a method and confirm → toast "Pago registrado", section disappears, badge gone from list

Also verify ingresos: the paid order should now appear in `GET /ingresos` for its delivery date.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/pages/clientes/creditInvoiceTemplate.ts frontend/src/app/pages/Clientes.tsx
git commit -m "feat: clientes page — debt badge, KPI, drawer credits section, payment modal, PDF invoice"
```

---

## Task 8: End-to-End Test

**Files:**
- Modify: `backend/test_e2e.py`

- [ ] **Step 1: Add credit flow test to test_e2e.py**

Append the following test section to `backend/test_e2e.py` (before the final summary block at the end of the file):

```python
# ===== CLIENT CREDIT FLOW =====
header("CLIENT CREDIT FLOW")

# Create a fresh order for credit testing
credit_plate = f"CRED{random.randint(10,99)}"
credit_order = requests.post(f"{BASE}/orders", json={
    "vehicle_type": "automovil",
    "plate": credit_plate,
    "brand": "Toyota",
    "model": "Corolla",
    "client_name": "Cliente Credito Test",
    "client_phone": f"311{random.randint(1000000,9999999)}",
    "service_ids": [exterior_service_id],   # reuse a service_id from earlier setup
}).json()
credit_order_id   = credit_order["id"]
credit_vehicle_id = credit_order["vehicle_id"]
info(f"Created credit test order #{credit_order['order_number']} plate={credit_plate}")

# Get patio entry for this order
patio_entries = requests.get(f"{BASE}/patio").json()
credit_entry  = next((e for e in patio_entries if e["order_id"] == credit_order_id), None)
if not credit_entry:
    fail("Credit patio entry not found")
else:
    ok("Credit patio entry created (esperando)")

    credit_entry_id = credit_entry["id"]

    # Advance esperando → en_proceso (auto-assign single detallado op if only one active)
    resp = requests.post(f"{BASE}/patio/{credit_entry_id}/advance", json={})
    if resp.status_code == 200:
        ok("Credit entry: esperando → en_proceso")
    else:
        fail(f"Credit entry: advance failed — {resp.text}")

    # Confirm all items so we can go to listo
    updated_entry = requests.get(f"{BASE}/patio").json()
    credit_entry_updated = next((e for e in updated_entry if e["id"] == credit_entry_id), None)
    if credit_entry_updated:
        for item in credit_entry_updated["order"]["items"]:
            requests.patch(f"{BASE}/patio/{credit_entry_id}/items/{item['id']}/confirm")

    # Advance en_proceso → listo (may auto-advance from all-confirmed, re-fetch)
    updated_entry = requests.get(f"{BASE}/patio").json()
    credit_entry_updated = next((e for e in updated_entry if e["id"] == credit_entry_id), None)
    if credit_entry_updated and credit_entry_updated["status"] != "listo":
        resp = requests.post(f"{BASE}/patio/{credit_entry_id}/advance", json={})
        if resp.status_code != 200:
            fail(f"Credit entry: en_proceso → listo failed — {resp.text}")

    # Advance listo → entregado WITH is_client_credit=true
    resp = requests.post(f"{BASE}/patio/{credit_entry_id}/advance", json={"is_client_credit": True})
    if resp.status_code == 200:
        r = resp.json()
        if r["status"] == "entregado" and r["order"]["is_client_credit"] is True:
            ok("Credit entry: listo → entregado with is_client_credit=True")
        else:
            fail(f"Credit entry: wrong state after credit advance — status={r['status']} is_client_credit={r['order'].get('is_client_credit')}")
        if float(r["order"]["payment_cash"]) == 0 and r["order"]["paid"] is False:
            ok("Credit delivery: payment_cash=0 and paid=False (correct)")
        else:
            fail(f"Credit delivery: expected payment_cash=0 paid=False, got cash={r['order']['payment_cash']} paid={r['order']['paid']}")
    else:
        fail(f"Credit entry: advance to entregado failed — {resp.text}")

    # Verify order is NOT yet in ingresos (payment_* all zero)
    ingresos = requests.get(f"{BASE}/ingresos?period=day").json()
    credit_in_ingresos = ingresos["order_count"]
    # We can't easily isolate this order — just verify the client's debt shows up
    info(f"Ingresos order_count today: {credit_in_ingresos}")

    # Get client id
    clients = requests.get(f"{BASE}/clients?search=Cliente Credito Test").json()
    credit_client = next((c for c in clients if c["phone"] and "311" in str(c["phone"])), None)
    if credit_client:
        ok("Credit client found in clients list")
        client_id = credit_client["id"]

        # pending_credit_total should be > 0
        if float(credit_client["pending_credit_total"]) > 0:
            ok(f"Client pending_credit_total={credit_client['pending_credit_total']} (correct)")
        else:
            fail(f"Client pending_credit_total is 0 (expected > 0)")

        # GET /clients/{id}/credits — should return one item
        credits = requests.get(f"{BASE}/clients/{client_id}/credits").json()
        if len(credits) == 1 and credits[0]["order_id"] == credit_order_id:
            ok(f"GET /clients/{client_id}/credits returns 1 pending credit")
        else:
            fail(f"Expected 1 credit, got {len(credits)}")

        # POST /clients/{id}/credits/pay — pay in cash
        pay_resp = requests.post(f"{BASE}/clients/{client_id}/credits/pay", json={
            "payment_cash":        float(credits[0]["amount"]),
            "payment_datafono":    0,
            "payment_nequi":       0,
            "payment_bancolombia": 0,
        })
        if pay_resp.status_code == 200 and pay_resp.json() == []:
            ok("POST credits/pay: returned empty list (all paid)")
        else:
            fail(f"POST credits/pay failed: {pay_resp.status_code} {pay_resp.text}")

        # Verify payment_cash was written to the order
        orders_after = requests.get(f"{BASE}/clients/{client_id}/credits").json()
        if orders_after == []:
            ok("GET /credits after payment: empty (no more pending debts)")
        else:
            fail(f"Credits still pending after payment: {orders_after}")

        # Verify client pending_credit_total is now 0
        clients_after = requests.get(f"{BASE}/clients?search=Cliente Credito Test").json()
        client_after  = next((c for c in clients_after if c["id"] == client_id), None)
        if client_after and float(client_after["pending_credit_total"]) == 0:
            ok("Client pending_credit_total=0 after payment (correct)")
        else:
            fail(f"Client still shows pending_credit_total={client_after['pending_credit_total'] if client_after else 'N/A'}")
    else:
        fail("Credit client not found in clients list")
```

- [ ] **Step 2: Run the e2e test**

Make sure the backend is running (check Docker or start locally):

```bash
cd backend && python test_e2e.py 2>&1 | tail -40
```

Expected: all new test cases show `[PASS]`.

- [ ] **Step 3: Commit**

```bash
git add backend/test_e2e.py
git commit -m "test: add client credit flow to e2e test suite"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - ✅ Button in listo→entregado payment modal (Task 6)
  - ✅ Confirmation step before credit delivery (Task 6)
  - ✅ Vehicle exits patio as `entregado` (Task 3 — same advance flow)
  - ✅ Restante after abono is the debt amount (Task 4 — `total - downpayment`)
  - ✅ Clientes page badge (Task 7 step 4)
  - ✅ Clientes page KPI "Con deuda" (Task 7 step 5)
  - ✅ Drawer credits section with table (Task 7 step 8)
  - ✅ Payment modal with 4 methods (Task 7 step 9)
  - ✅ PDF consolidated invoice (Task 7 steps 1, 7)
  - ✅ Income enters ingresos at delivery date when paid (Task 3 — payment_* filled on pay, patio_entry.delivered_at unchanged)
  - ✅ Operators liquidated from entregado (not affected — Task 3 advances to entregado normally)

- [x] **No placeholders** — all code is complete.

- [x] **Type consistency:**
  - `is_client_credit: boolean` used consistently in `ApiOrder` (Task 5 step 1) and `AdvancePayload` (Task 2 step 1)
  - `ClientCreditOut` / `ApiClientCredit` — same shape, defined in Task 2 step 4 and Task 5 step 3
  - `ClientCreditPayment` / `ClientCreditPaymentPayload` — same fields
  - `api.clients.getCredits` returns `ApiClientCredit[]` ✅
  - `api.clients.payCredits` takes `ClientCreditPaymentPayload` ✅
  - `onCreditDelivery` prop matches `() => Promise<void>` in both interface and call site ✅
  - `buildCreditInvoiceHtml(client, credits, generatedAt)` signature matches usage in `handleDownloadInvoice` ✅
