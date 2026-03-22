# BDCPolo — CLAUDE.md

Car-wash management system for Bogotá Detailing Center. Full-stack: React/Vite frontend + FastAPI backend + PostgreSQL, all running in Docker.

## Quick start

```bash
docker compose up --build      # first run (builds images + seeds DB)
docker compose up              # subsequent runs
```

- Frontend: http://localhost:5173
- Backend API + Swagger: http://localhost:8000/docs
- PostgreSQL: localhost:5432 (user: postgres, pass: bdcpolo123, db: bdcpolo)

## Architecture

```
BDCP/
├── .gitignore
├── docker-compose.yml          # 3 services: db, backend, frontend
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py             # FastAPI app, seeds DB on first start, mounts all routers
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── models.py           # ORM models + all enums
│   │   ├── schemas.py          # Pydantic v2 request/response models
│   │   └── routers/
│   │       ├── services.py     # GET /services
│   │       ├── operators.py    # GET /operators
│   │       ├── vehicles.py     # GET /vehicles/by-plate/{plate}
│   │       ├── orders.py       # POST /orders (creates order + patio entry + ceramic record atomically)
│   │       ├── patio.py        # GET /patio, POST /patio/{id}/advance, PATCH /patio/{id}
│   │       ├── ceramics.py     # GET /ceramics
│   │       ├── history.py      # GET /history
│   │       └── liquidation.py  # GET+POST /liquidation (weekly, debts, abonos)
│   └── database/
│       ├── schema.sql          # CREATE TABLE reference (not run at boot)
│       └── seed.sql            # reference seed (actual seeding done in main.py)
└── frontend/
    ├── Dockerfile
    ├── vite.config.ts          # @tailwindcss/vite plugin, @ alias → ./src
    ├── src/
    │   ├── api/index.ts        # typed API client (apiFetch wrapper + all endpoint methods)
    │   ├── types/index.ts      # TypeScript interfaces mirroring DB schema
    │   ├── data/mock.ts        # mock data (used only by pages not yet wired to API)
    │   ├── app/
    │   │   ├── routes.tsx      # createBrowserRouter, 8 pages
    │   │   ├── context/AppContext.tsx  # fetches services+operators from API; createOrder()
    │   │   ├── components/
    │   │   │   ├── Layout.tsx          # responsive: desktop collapsible sidebar + mobile hamburger overlay
    │   │   │   └── ui/                 # cn, Badge, Button, Input, GlassCard, Modal, Select, Tabs, etc.
    │   │   └── pages/          # 8 pages (see Routes)
    │   └── styles/
    │       ├── index.css       # @import tailwind.css + theme.css
    │       ├── tailwind.css    # @import "tailwindcss"
    │       └── theme.css       # @theme {} tokens + @layer base body/scrollbar
```

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 + TypeScript, Vite 6, Tailwind v4, Framer Motion 11, React Router v7 |
| UI        | Radix UI primitives, lucide-react, recharts, sonner (toasts), date-fns v3, CVA |
| Backend   | FastAPI + SQLAlchemy 2.0 + psycopg2-binary + Pydantic v2 |
| Database  | PostgreSQL 16 |
| Infra     | Docker Compose |

## API endpoints

All routes are prefixed `/api/v1/`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/services` | List active services with prices |
| GET    | `/operators` | List active operators (includes `cedula`) |
| GET    | `/vehicles/by-plate/{plate}` | Look up vehicle by plate (pre-fills form) |
| POST   | `/orders` | Create order → auto-creates patio entry + ceramic record if applicable |
| GET    | `/patio` | List all patio entries with nested vehicle + order + items |
| POST   | `/patio/{id}/advance` | Advance status: esperando→en_proceso→listo→entregado |
| PATCH  | `/patio/{id}` | Assign operator, add/remove services (`service_ids: []` allowed — sets total to 0); syncs operator to ceramic_treatments |
| DELETE | `/patio/{id}` | Cancel entry (esperando or en_proceso only): deletes items, marks order cancelado, removes patio entry |
| GET    | `/appointments?month=YYYY-MM` | List appointments for a month |
| POST   | `/appointments` | Create appointment |
| PATCH  | `/appointments/{id}` | Edit appointment (date, time, vehicle, client, status) |
| DELETE | `/appointments/{id}` | Delete appointment |
| GET    | `/ceramics` | List all ceramic treatments with vehicle + operator |
| GET    | `/history` | Order history with optional `date_filter` and `search` query params |
| GET    | `/liquidation/{op_id}/week?week_start=YYYY-MM-DD` | Weekly liquidation data (7 days, qualifying orders) |
| POST   | `/liquidation/{op_id}/liquidate?week_start=YYYY-MM-DD` | Confirm liquidation: process abonos, settlements, payment methods, auto-create pending debts |
| GET    | `/liquidation/{op_id}/debts` | List all debts for an operator (with payment history) |
| POST   | `/liquidation/{op_id}/debts` | Create a new debt |
| PATCH  | `/liquidation/debts/{debt_id}/paid` | Mark debt as fully paid |

## Routes

| Path               | Page              | Backend wired? | Description |
|--------------------|-------------------|----------------|-------------|
| `/`                | IngresarServicio  | ✅ | 3-step wizard → `POST /orders` |
| `/calendario`      | CalendarioCitas   | ✅ | Monthly calendar + appointment management |
| `/patio`           | EstadoPatio       | ✅ | Kanban fetched from `GET /patio`; advance/edit via API |
| `/inventario`      | Inventario        | ❌ mock | Inventory management with stock levels |
| `/ceramicos`       | Ceramicos         | ✅ | Ceramic treatment tracking; fetched from `GET /ceramics` |
| `/liquidacion`     | Liquidacion       | ✅ | Operator commission liquidation (password: `BDCP123`) |
| `/ingresos-egresos`| IngresosEgresos   | ❌ mock | Financial transactions + charts |
| `/documentos`      | Documentos        | ❌ mock | Document management |
| `/historial`       | Historial         | ✅ | Order history with search + date filter |

## Design system

- **Palette**: `gray-950` page bg → `gray-900` sidebar → `white/[0.03]` glass cards
- **Accent**: `yellow-500` / `yellow-400` for CTAs, active nav, highlights
- **Glass**: `backdrop-blur-sm` + `border border-white/8`
- **Tailwind v4**: no `tailwind.config.js`, no postcss.config — uses `@tailwindcss/vite` plugin
- **Tokens**: defined in `src/styles/theme.css` inside `@theme {}` block
- **Responsive**: mobile-first. Desktop has collapsible sidebar; mobile has top bar + hamburger overlay nav.

## Domain enums (mirror DB)

```
VehicleType:        automovil | camion_estandar | camion_xl
ServiceCategory:    exterior | interior | ceramico | correccion_pintura
OrderStatus:        pendiente | en_proceso | listo | entregado | cancelado
PatioStatus:        esperando | en_proceso | listo | entregado
AppointmentStatus:  programada | confirmada | completada | cancelada | no_asistio
TransactionType:    ingreso | egreso
DebtDirection:      empresa_operario | operario_empresa
```

## DB tables (beyond the basics)

| Table | Purpose |
|-------|---------|
| `ceramic_treatments` | Auto-created when a ceramic service is ordered; operator synced via patio PATCH |
| `debts` | Tracks money owed between company and operator; supports partial payments via `paid_amount` |
| `debt_payments` | Individual installment records (abonos) linked to a debt and optionally to a week_liquidation |
| `week_liquidations` | One record per operator per week when liquidated; stores net, transfer, cash, pending amounts |

### Extra columns added via ALTER TABLE (not in original schema.sql)

```sql
-- Run once if DB was created before these were added:
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS downpayment NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patio ADD COLUMN IF NOT EXISTS scheduled_delivery_at TIMESTAMP;
```

## Service order flow

1. **IngresarServicio** — 3-step wizard:
   - **Step 1**: Select vehicle type (Automóvil / Camioneta Estándar / Camioneta XL).
   - **Step 2**: Fill form. Plate lookup (`onBlur`) calls `GET /vehicles/by-plate/{plate}`:
     - **Type match**: autofills brand, model, color, client name, and phone.
     - **Type mismatch**: autofills client info only; shows warning toast; disables service selection and "Revisar Orden" button until user selects the correct vehicle type.
     - Plate cleared → all autofilled fields cleared immediately.
   - Optional fields: delivery date/time, abono (partial payment), "Entrada por garantía" toggle.
   - **Step 3 (Revisar Orden)**: Read-only summary with:
     - Per-service price editing (pencil icon); discount shown as `−$X (Y%)`.
     - When "Garantía" is ON: ShieldCheck icon per service to toggle warranty coverage individually — warranty services display `$0` with strikethrough of original price; non-warranty services keep normal/custom price.
     - If abono > 0: shows Total / Abono / Restante breakdown.
   - Confirm → `POST /api/v1/orders` with `item_overrides` (custom and warranty prices), `scheduled_delivery_at`, `downpayment`, `is_warranty`.
2. Backend creates atomically: client (find or create by phone), vehicle (find or create by plate), order, order items (price snapshot via `item_overrides`), patio entry (`esperando`). If any item is `ceramico` category, also creates a `CeramicTreatment` record with `next_maintenance = application_date + 6 months`.
3. **EstadoPatio**: fetches `GET /api/v1/patio` on mount. Kanban cards advance via `POST /patio/{id}/advance`. Services editable via `PATCH /patio/{id}`. Operator assigned via modal on first advance.
   - **Cards**: collapsed by default showing vehicle icon, brand/model, plate/color, operator, delivery date/time, elapsed time, and advance button. Clicking the card expands it to show client name/phone, service badges, financial breakdown (total / abono / resta), and "Editar orden" link.
   - Advancing from `esperando` → `en_proceso` **requires** an operator: if none assigned, a picker modal appears first; selects operator via `PATCH`, then advances.
   - **Editar orden** modal:
     - Available for `esperando` and `en_proceso` statuses. Read-only for `listo` and `entregado`.
     - Shows current services as a list with X buttons to remove each one.
     - Shows category accordion below to add new services (only services not already in the order).
     - If all services are removed and "Guardar" is pressed → confirmation step: *"¿Está seguro?"* with "No, volver" / "Sí, cancelar".
     - Confirming cancellation calls `DELETE /patio/{id}`: deletes order items, marks order as `cancelado`, removes patio entry. Vehicle disappears from kanban immediately.
     - No operator selector in edit modal — operator is only assigned via the advance-to-en_proceso flow.
   - **GET /patio** filters: returns all non-delivered entries + entries delivered today.
   - Delivery date picker: `min` set to today — past dates not selectable. Hour picker is a custom styled dropdown showing full hours only (6:00–18:00).
4. Plate format: uppercase alphanumeric only, max 6 chars — stripped on input with `/[^A-Z0-9]/g`.
5. Operator **not** selected during order entry — assigned at patio stage (required to start work).

## Liquidation flow

1. Password gate (`BDCP123`) on every visit.
2. Operator grid: colored initials, no amounts shown.
3. Operator detail: week carousel (Sun–Sat), daily accordion with total + commission per day.
4. Only orders with patio status `en_proceso | listo | entregado` and an assigned operator count.
5. **Liquidar semana** opens a modal with:
   - Abonos: input per unpaid `operario_empresa` debt — deducted from payout and recorded as `DebtPayment`
   - Settlements: toggle per unpaid `empresa_operario` debt to include in payout
   - Payment methods: Transferencia + Efectivo fields; if sum < net → auto-creates `empresa_operario` debt for the pending amount
   - On confirm: creates `WeekLiquidation` record, links `DebtPayment` records to it
6. Post-liquidation shows payment breakdown (neto, transferencia, efectivo, pendiente).
7. **Descargar** button opens a period picker modal:
   - "Esta semana" → calls `GET /api/v1/liquidation/{op_id}/report?period=week&ref_date=<weekStart>`
   - "Mes de X" → calls `GET /api/v1/liquidation/{op_id}/report?period=month&ref_date=<weekStart>`
     - If the selected week is in the **current month**: `de = today` (month-to-date). Label: "Mes actual (hasta hoy)"
     - If the selected week is in a **past month**: `de = last day of that month` (full month). Label: "Mes de Febrero 2026"
8. **"Otro mes"** button (Calendar icon, next to Descargar) opens a `<input type="month">` picker to generate a report for any arbitrary month.

## PDF Invoice template

The invoice HTML template is generated entirely in the frontend at:

**`frontend/src/app/pages/Liquidacion.tsx`** — function `printReport(r: ApiReportResponse)`

Structure of the generated HTML:
```
<html>
  <head>  → inline <style> block (no external CSS)
  <body onload="window.print()">  → auto-opens print dialog
    .header       → BDCPolo logo (left) + "Liquidacion de Operario" title + period/date (right)
    .section      → Operario: name, commission %, service count
    .section      → Detalle de servicios: <table> Servicio | Cant. | Precio unit. | Subtotal
                    Rows grouped by order (order_number · plate · brand/model + date as header)
    .totals       → right-aligned: Total bruto / Comision (X%) / Neto a pagar
    .footer       → "Bogota Detailing Center · BDCPolo · Comprobante interno"
```

Key implementation details:
- Opened as a **Blob URL** via `URL.createObjectURL` — avoids DOM injection APIs
- All user-supplied strings pass through `escapeHtml()` before insertion
- `body onload` triggers the browser Save-as-PDF dialog automatically
- Prices formatted with `Number(n).toLocaleString('es-CO')` (Colombian pesos)
- Backend endpoint: `GET /api/v1/liquidation/{op_id}/report?period=week|month&ref_date=YYYY-MM-DD`
  - Defined in `backend/app/routers/liquidation.py` → `def get_report(...)`
  - Response schema: `ReportResponse` in `backend/app/schemas.py`

## Key decisions

- **API client at `src/api/index.ts`**: single `apiFetch` wrapper; all typed methods grouped by resource. `API_BASE` defaults to `http://localhost:8000/api/v1`, overridable via `VITE_API_URL` env var.
- **Prices as strings from API**: FastAPI/Pydantic v2 serializes `Decimal` as string. Always wrap with `Number()` before arithmetic — e.g. `Number(service.price_automovil)`.
- **`toLocaleString('es-CO')`**: used on all price displays for Colombian peso formatting.
- **AppContext** provides only `services`, `operators`, `loading`, and `createOrder()`. No global patio/ceramic/liquidation state — each page fetches its own data.
- **Password gate** for Liquidacion uses `useState` (not sessionStorage) — resets on page refresh.
- **`native_enum=False`** on all SQLAlchemy Enums → stored as VARCHAR. Column widths expanded to VARCHAR(30) for `category` columns after adding `correccion_pintura`.
- **`_seed_if_empty()`** reseeds services if `count != 28` (restart-to-update pattern). Operators seeded only if table is empty.
- **Ceramic treatments**: auto-created in `POST /orders` for every `ceramico` service; `operator_id` synced on `PATCH /patio/{id}` if operator changes.
- **Week starts on Sunday** (`weekStartsOn: 0` in date-fns). `week_start` param is always the Sunday ISO date.
- **Backend API prefix**: `/api/v1/` — all routers mounted under this prefix in `main.py`.
- **`item_overrides`** in `POST /orders`: array of `{ service_id, unit_price }` that override the standard price snapshot. Used for custom discounts (any price) and warranty services (`unit_price: 0`). Backend builds `override_map` and computes discount as `sum(std - override)`.
- **Plate uniqueness**: a plate is always tied to one vehicle type and one client. On plate lookup type mismatch, the frontend blocks service selection and the "Revisar Orden" button; client info is still returned and autofilled regardless of type match.
- **Operator assignment flow**: operator is NOT selected during order entry. It is required when advancing a patio card from `esperando` → `en_proceso`. If no operator is assigned at that point, an operator-picker modal intercepts the advance: calls `PATCH /patio/{id}` to set operator, then `POST /patio/{id}/advance`.
- **Warranty orders** (`is_warranty: true`): individual services can be marked as warranty in step 3. Warranty services are sent with `unit_price: 0` via `item_overrides`. Non-warranty services in the same order keep their normal/custom price. Total reflects only non-warranty services.
- **`getEffectivePrice` vs `getStandardPrice`** (IngresarServicio): `getEffectivePrice` checks `warrantyServiceIds` first (returns 0), then `customPrices`, then falls back to standard price. Used for totals and step 3 display. `getStandardPrice` always returns the catalog price; used for discount calculation.
- **`apiFetch` handles 204**: returns `undefined` without calling `res.json()` when status is 204 or `content-length: 0` — required for the DELETE /patio endpoint.
- **Patio card UX**: collapsed/expanded toggle per card (local `expanded` state inside `PatioCard`). Collapsed = minimal info; expanded = client, services, financials, edit button.
- **Service editing scope**: `PATCH /patio/{id}` with `service_ids` is accepted for `esperando` and `en_proceso`. For `listo`/`entregado` the frontend sends no `service_ids` field. `service_ids: []` (empty) is valid — sets total/subtotal to 0; use `DELETE /patio/{id}` to fully remove from kanban.
- **Cancellation flow**: removing all services + confirming in the edit modal calls `DELETE /patio/{id}` (not PATCH). The backend checks status is `esperando` or `en_proceso` before allowing deletion.

## Common commands

```bash
# Rebuild after dependency changes
docker compose up --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart just the backend (after Python code changes)
docker compose restart backend

# Open psql inside the DB container
docker compose exec db psql -U postgres -d bdcpolo

# Run backend outside Docker (needs local PostgreSQL)
cd backend && python -m uvicorn app.main:app --reload --port 8000
```
