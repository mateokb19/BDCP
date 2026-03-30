# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Car-wash management system for Bogotá Detailing Center. Full-stack: React/Vite frontend + FastAPI backend + PostgreSQL, all running in Docker.

## Quick start

```bash
docker compose up --build      # first run (builds images + seeds DB)
docker compose up              # subsequent runs
```

- Frontend: http://localhost:28001
- Backend API + Swagger: http://localhost:28000/docs
- PostgreSQL: localhost:54321 (user: postgres, pass: bdcpolo123, db: bdcpolo)

Docker port mapping: host 28000 → container 8000 (backend), host 28001 → container 5173 (frontend).

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
│   │       ├── liquidation.py  # GET+POST /liquidation (weekly, debts, abonos)
│   │       ├── ingresos.py     # GET /ingresos
│   │       ├── egresos.py      # GET+POST+DELETE /egresos
│   │       └── clients.py      # GET /clients, PATCH /clients/{id}
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
    │   │   ├── routes.tsx      # createBrowserRouter, 10 pages
    │   │   ├── context/AppContext.tsx  # fetches services+operators from API; createOrder()
    │   │   ├── components/
    │   │   │   ├── Layout.tsx          # responsive: desktop collapsible sidebar + mobile hamburger overlay
    │   │   │   └── ui/                 # cn, Badge, Button, Input, GlassCard, Modal, Select, Tabs, etc.
    │   │   └── pages/          # 10 pages (see Routes)
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
| GET    | `/operators?include_inactive=true` | List operators; `include_inactive=true` returns all including deactivated |
| POST   | `/operators` | Create new operator (name, phone, cedula, commission_rate) |
| PATCH  | `/operators/{id}` | Update operator fields or toggle `active` (deactivate/reactivate) |
| GET    | `/vehicles/by-plate/{plate}` | Look up vehicle by plate (pre-fills form) |
| POST   | `/orders` | Create order → auto-creates patio entry + ceramic record if applicable |
| GET    | `/patio` | List all patio entries with nested vehicle + order + items |
| POST   | `/patio/{id}/advance` | Advance status: esperando→en_proceso→listo→entregado |
| PATCH  | `/patio/{id}` | Assign operator, add/remove services (`service_ids: []` allowed — sets total to 0), update `scheduled_delivery_at`; syncs operator to ceramic_treatments |
| DELETE | `/patio/{id}` | Cancel entry (esperando or en_proceso only): deletes items, marks order cancelado, removes patio entry |
| PATCH  | `/patio/{entry_id}/items/{item_id}/confirm` | Toggle `is_confirmed` on a service order item (checklist check/uncheck); triggers individual item liquidation |
| GET    | `/appointments?month=YYYY-MM` | List appointments for a month |
| POST   | `/appointments` | Create appointment |
| PATCH  | `/appointments/{id}` | Edit appointment (date, time, vehicle, client, status) |
| DELETE | `/appointments/{id}` | Delete appointment |
| GET    | `/ceramics` | List all ceramic treatments with vehicle + operator |
| GET    | `/history` | Order history — `date_filter=YYYY-MM-DD` (single day, default today), OR `date_from`+`date_to` (range for PDF export), optional `search` (plate/client/order number) |
| GET    | `/liquidation/{op_id}/week?week_start=YYYY-MM-DD` | Weekly liquidation data (7 days, qualifying orders) |
| POST   | `/liquidation/{op_id}/liquidate?week_start=YYYY-MM-DD` | Confirm liquidation: process abonos, settlements, payment methods, auto-create pending debts + expense records |
| GET    | `/liquidation/{op_id}/pending` | Count unliquidated orders for the operator (used to enable/disable the liquidate button) |
| POST   | `/liquidation/{op_id}/liquidate-pending` | Liquidate all pending orders across all weeks at once |
| GET    | `/liquidation/{op_id}/debts` | List all debts for an operator (with payment history) |
| POST   | `/liquidation/{op_id}/debts` | Create a new debt |
| PATCH  | `/liquidation/debts/{debt_id}/paid` | Mark debt as fully paid |
| GET    | `/liquidation/{op_id}/report?period=week\|month&ref_date=YYYY-MM-DD` | Generate PDF-ready report |
| GET    | `/ingresos?period=day\|week\|month\|year&ref_date=YYYY-MM-DD` | Income totals by payment method + daily breakdown (includes abonos) |
| GET    | `/ingresos/breakdown?method=cash\|datafono\|nequi\|bancolombia&date_start=&date_end=` | Per-order breakdown for a payment method; includes abono rows (`is_abono: true`) |
| GET    | `/egresos?date_start=&date_end=` | List expenses |
| POST   | `/egresos` | Create expense |
| DELETE | `/egresos/{id}` | Delete expense |
| GET    | `/clients?search=` | List all clients with vehicles, order count, total spent, last service |
| PATCH  | `/clients/{id}` | Update client name, phone, email, invoice fields (tipo_persona, tipo_identificacion, identificacion, dv), notes |

## Routes

| Path               | Page              | Backend wired? | Description |
|--------------------|-------------------|----------------|-------------|
| `/`                | IngresarServicio  | ✅ | 3-step wizard → `POST /orders` |
| `/calendario`      | CalendarioCitas   | ✅ | Monthly calendar + appointment management |
| `/patio`           | EstadoPatio       | ✅ | Kanban fetched from `GET /patio`; advance/edit via API |
| `/inventario`      | Inventario        | ❌ mock | Inventory management with stock levels |
| `/ceramicos`       | Ceramicos         | ✅ | Ceramic treatment tracking; fetched from `GET /ceramics` |
| `/liquidacion`     | Liquidacion       | ✅ | Operator commission liquidation (password: `BDCP123`) |
| `/ingresos-egresos`| IngresosEgresos   | ✅ | Balance per payment method + manual expense CRUD + charts |
| `/documentos`      | Documentos        | ❌ mock | Document management |
| `/historial`       | Historial         | ✅ | Order history with search + date filter. PPF/Polarizado orders hidden by default; Eye button unlocks admin mode (password: `BDCP123`) |
| `/clientes`        | Clientes          | ✅ | Client database with search, vehicle list, edit, stats |

## Design system

- **Palette**: `gray-950` page bg → `gray-900` sidebar → `white/[0.03]` glass cards
- **Accent**: `yellow-500` / `yellow-400` for CTAs, active nav, highlights
- **Glass**: `backdrop-blur-sm` + `border border-white/8`
- **Tailwind v4**: no `tailwind.config.js`, no postcss.config — uses `@tailwindcss/vite` plugin
- **Tokens**: defined in `src/styles/theme.css` inside `@theme {}` block
- **Responsive**: mobile-first. Desktop has collapsible sidebar; mobile has top bar + hamburger overlay nav.

## Domain enums (mirror DB)

```
VehicleType:        moto | automovil | camion_estandar | camion_xl
ServiceCategory:    exterior | interior | ceramico | correccion_pintura | latoneria | pintura | ppf | polarizado
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
| `week_liquidations` | One record per operator per week when liquidated; stores net, cash/datafono/nequi/bancolombia breakdown, pending amount |
| `expenses` | Manual expense records; also auto-created by liquidation for operator payouts (one row per payment method used) |

### Extra columns added via ALTER TABLE (not in original schema.sql)

All migrations run idempotently at backend startup in `main.py`. If starting from a fresh DB they run automatically. If adding to an existing DB:

```sql
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS downpayment NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patio ADD COLUMN IF NOT EXISTS scheduled_delivery_at TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tipo_identificacion VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS identificacion VARCHAR(30);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dv VARCHAR(2);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_cash NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_datafono NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_nequi NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS payment_bancolombia NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS downpayment_method VARCHAR(50);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS latoneria_operator_pay NUMERIC(12,2);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS latoneria_liquidation_id INTEGER REFERENCES week_liquidations(id) ON DELETE SET NULL;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS pintura_liquidation_id INTEGER REFERENCES week_liquidations(id) ON DELETE SET NULL;
ALTER TABLE week_liquidations ALTER COLUMN payment_transfer SET DEFAULT 0;  -- legacy column, no longer written
ALTER TABLE week_liquidations ADD COLUMN IF NOT EXISTS payment_datafono NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE week_liquidations ADD COLUMN IF NOT EXISTS payment_nequi NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE week_liquidations ADD COLUMN IF NOT EXISTS payment_bancolombia NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS operator_type VARCHAR(30) NOT NULL DEFAULT 'detallado';
ALTER TABLE service_order_items ADD COLUMN IF NOT EXISTS standard_price NUMERIC(10,2);
-- Backfill: UPDATE service_order_items SET standard_price = unit_price WHERE standard_price IS NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_moto NUMERIC(12,2);
-- Seed: UPDATE services SET price_moto = 40000, price_automovil = 60000 WHERE name = 'Premium Wash' AND category = 'exterior';
-- Seed: UPDATE services SET price_moto = 60000 WHERE name = 'Premium Wash Hidrofobic' AND category = 'exterior';
ALTER TABLE service_order_items ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
-- Backfill: UPDATE service_order_items SET is_confirmed = TRUE WHERE order_id IN (SELECT so.id FROM service_orders so JOIN patio p ON p.order_id = so.id WHERE p.status IN ('listo', 'entregado'));
```

> **`week_liquidations.payment_transfer`**: legacy column — still in DB (NOT NULL, now has `DEFAULT 0`) but no longer written to or read by the model. New liquidations only populate `payment_cash`, `payment_datafono`, `payment_nequi`, `payment_bancolombia`. If you ever remove `payment_transfer` from the DB you must first drop the NOT NULL constraint or set a default, because SQLAlchemy's INSERT omits unmapped columns.

## Service order flow

1. **IngresarServicio** — 3-step wizard:
   - **Step 1**: Select vehicle type (Moto / Automóvil / Camioneta Estándar / Camioneta XL). Clicking a type goes directly to step 2.
   - **Step 2**: Fill form. Plate lookup (`onBlur`) calls `GET /vehicles/by-plate/{plate}`:
     - **Type match**: autofills brand, model, color, client name, and phone.
     - **Type mismatch**: autofills client info only; shows warning toast; disables service selection and "Revisar Orden" button until user selects the correct vehicle type.
     - Plate cleared → all autofilled fields cleared immediately.
   - **Service selection (step 2)**: services column shows 5 collapsible accordion sections — Detallado (Exterior / Interior / Corrección / Cerámico), Latonería, Pintura, PPF, Polarizado. "Detallado" is open by default; all others start closed. Services from multiple areas can be combined in one order. Each accordion header shows a count badge when services are selected from that area.
     - **Moto service restriction**: when vehicle type is Moto, within the Detallado accordion only the Exterior sub-section is shown (Interior, Corrección, Cerámico are hidden), and within Exterior only services with `price_moto` set are listed (currently "Premium Wash" $40,000 and "Premium Wash Hidrofobic" $60,000). The Detallado accordion auto-opens when Moto is selected. Latonería, Pintura, PPF, Polarizado, and "Otros servicios" remain available for motos.
     - **Moto pricing**: uses `price_moto` column for display price (what client pays). `standard_price` in `service_order_items` is set to `price_automovil` for moto orders so detallado commission is based on the automóvil catalog price ($60,000 / $85,000). `price_moto` column added to `services` table via migration.
     - **PPF / Polarizado**: seeded with price $0; user enters a custom price per service in step 2 (editable input).
     - **Latonería**: seeded with $0 for most pieces (except Desmonte/Monte Bumper at $110k); inline price input per piece.
     - **Pintura**: fixed prices per piece ($220k = ½ pieza, $430k = 1 pieza, $860k = 2 piezas); same price for all vehicle types.
   - Optional fields: delivery date/time (hour picker shows 8:00–17:00), abono (partial payment with method selector), "Entrada por garantía" toggle.
   - **Abono method selector**: when abono > 0, 4 checkbox buttons appear — Efectivo, Banco Caja Social, Nequi, Bancolombia. Selected method stored as `downpayment_method` and sent to backend.
   - **Abono cap**: abono is automatically capped at the order total (cannot exceed it). "Abonar total" checkbox button sets abono to the full total instantly.
   - Number inputs (price edit, abono): `onWheel={e => e.currentTarget.blur()}` blocks accidental scroll-wheel changes.
   - **Step 3 (Revisar Orden)**: Read-only summary with:
     - Per-service price editing (pencil icon); discount shown as `−$X (Y%)`.
     - When "Garantía" is ON: ShieldCheck icon per service to toggle warranty coverage individually — warranty services display `$0` with strikethrough of original price; non-warranty services keep normal/custom price.
     - If abono > 0: shows Total / Abono / Restante breakdown.
   - Confirm → `POST /api/v1/orders` with `item_overrides` (custom and warranty prices), `scheduled_delivery_at`, `downpayment`, `downpayment_method`, `is_warranty`.
2. Backend creates atomically: client (find or create by phone), vehicle (find or create by plate), order, order items (price snapshot via `item_overrides`), patio entry (`esperando`). If any item is `ceramico` category, also creates a `CeramicTreatment` record with `next_maintenance = application_date + 6 months`.
3. **EstadoPatio**: fetches `GET /api/v1/patio` on mount. Kanban cards advance via `POST /patio/{id}/advance`. Services editable via `PATCH /patio/{id}`. Operator assigned via modal on first advance.
   - **Cards**: collapsed by default showing vehicle icon, brand/model, plate/color, operator, delivery date/time, elapsed time, and advance button. Clicking the card expands it to show client name/phone, service checklist or badges, financial breakdown (total / abono / resta), payment breakdown (if entregado), facturación electrónica panel (if requested), and "Editar orden" link.
   - **Service completion checklist**: all `en_proceso` cards show each service as a tappable checkbox row **always visible** (outside the expanded section, no need to open the card). Checked services show a green `CheckCircle2` icon + strikethrough text; unchecked show a gray `Circle` icon. The collapsed card header shows an animated progress bar + `N/M` counter (green when all checked, yellow otherwise). **When all checkboxes are checked, the card auto-advances to `listo` after a 400ms delay.** The "Completar" button is hidden for `en_proceso` — the only way to advance is via checkboxes. Each checkbox check/uncheck calls `PATCH /patio/{entry_id}/items/{item_id}/confirm` which toggles `is_confirmed` on the item; state is driven from the API response (not localStorage). Cards in other statuses show service badges in the expanded view only.
   - **Individual item liquidation**: an order enters the operator's liquidation **when individual items are confirmed** (checkbox checked), not on status transition. `QUALIFYING_STATUSES = {"en_proceso", "listo", "entregado"}` but only orders with at least one `is_confirmed` item of the relevant category qualify. Commission is calculated from confirmed items only. Existing listo/entregado orders are backfilled with `is_confirmed = TRUE` on migration.
   - Advancing from `esperando` → `en_proceso` **requires** an operator: collects all required operator types from service categories, finds candidates per type. If every type has exactly one candidate, all are auto-assigned without showing the picker (e.g. latonería+pintura orders auto-assign their single operators). Only shows the picker when detallado has multiple candidates. The modal also includes a **notes textarea** ("Daños o piezas faltantes") pre-filled with any existing `entry.notes`. On confirm, sends `notes` alongside `operator_id` in the `PATCH /patio/{id}` call. Cards show an orange `⚠` badge in the collapsed header when `entry.notes` is non-empty; expanded view shows the note text in an orange-tinted panel.
   - **Editar orden** modal:
     - Available for `esperando` and `en_proceso` statuses. Read-only for `listo` and `entregado`.
     - **Operator selectors per type**: groups selected services by `operator_type` via `CAT_TO_OP_TYPE` mapping. Shows one operator dropdown per needed type (Detallado, Pintura, Latonería). **PPF and Polarizado are excluded** (`NO_OPERATOR_TYPES` set) — they are handled as third-party payments and never require an internal operator. Types with a single active operator auto-assign. Types with multiple candidates show a required dropdown. All non-excluded types must have an operator assigned before saving.
     - **All 8 service categories** available in the add-services accordion: Exterior, Interior, Corrección, Cerámico, Latonería, Pintura, PPF, Polarizado.
     - **Inline price editing**: each selected service has an editable price input (COP formatted). Shows strikethrough of standard price when custom. Backend receives `item_overrides` for non-standard prices.
     - **Downpayment validation**: "Guardar" disabled with red message when new total < abono. Also validated server-side (HTTP 400).
     - Shows current services as a list with X buttons to remove each one.
     - If all services are removed and "Guardar" is pressed → confirmation step: *"¿Está seguro?"* with "No, volver" / "Sí, cancelar".
     - Confirming cancellation calls `DELETE /patio/{id}`: deletes order items, marks order as `cancelado`, removes patio entry. Vehicle disappears from kanban immediately.
     - **`operator_id` resolution on save**: detallado operator takes priority for `order.operator_id`; falls back to first assigned type if no detallado services. This ensures mixed orders (e.g., pintura + detallado added later) always have the correct operator for liquidation.
   - **Duplicate vehicle prevention**: `POST /orders` returns HTTP 409 if the vehicle already has an active patio entry (status != `entregado`). Frontend shows a toast with the plate number.
   - **Midnight auto-refresh**: a `setInterval` (60s) in EstadoPatio detects day change and re-fetches `/patio`, automatically removing yesterday's delivered entries from the kanban.
   - **Active-only operator picker**: when the advance-to-en_proceso modal opens, it fetches fresh active operators from `GET /operators` (not the stale AppContext cache) so deactivated operators never appear as options.
   - **GET /patio** filters: returns all non-delivered entries + entries delivered today.
   - **Inline delivery date editor**: pencil icon next to the delivery date in the card summary (independent of "Editar orden"). Click opens an inline animated panel with a dark-styled date picker + hour selector (8–17). Saves via `PATCH /patio/{id}` with `scheduled_delivery_at`. "Sin fecha de entrega" shown when no date set.
   - Delivery date picker in the inline editor: dark-themed via `style={{ colorScheme: 'dark' }}` + `[&::-webkit-calendar-picker-indicator]:invert`. Hour selector shows 8:00–17:00.
   - **Advancing listo → entregado**: intercepts with a payment modal:
     - **When restante = 0** (abono covered the full amount): payment modal still opens but the method-selection section is hidden. Only the facturación electrónica section is shown. Confirmar is always enabled.
     - **When restante > 0**: checkboxes for Efectivo, Banco Caja Social, Nequi (3118777229 / llave NEQUIJUL11739), Bancolombia Ahorros (60123354942 / llave @SaraP9810). Confirmar disabled until at least one method is checked. One method checked → amount = full restante automatically. Multiple methods checked → inline amount input per method + balance indicator.
     - **Facturación electrónica**: optional checkbox at the bottom. When checked, expands a form for Tipo (Persona Natural / Empresa), Tipo de identificación (CC/CE/PP/TI or NIT/CE), Número de identificación + Dv (NIT only), Nombre and Teléfono (pre-filled from order client), Correo electrónico. Form is **pre-filled from the client's saved profile** (`entry.vehicle?.client` fields: `tipo_persona`, `tipo_identificacion`, `identificacion`, `dv`, `email`); if the client already has `tipo_persona` and `identificacion`, the factura checkbox is auto-checked. On confirm: saves factura data to `localStorage` under `bdcpolo_facturas` **and** persists it to the client record via `PATCH /api/v1/clients/{id}` so future orders for the same client pre-fill automatically.
     - On confirm: saves 4 payment amounts to order + marks `paid=True`.
   - **Facturación electrónica indicator**: delivered cards with saved factura data show a blue "FE" pill badge in the collapsed header. Expanded view shows a blue-tinted panel with Tipo, ID type+number+Dv, and email.
   - **Bodega minimap**: sticky panel (200×300px floor plan, visible `xl+` only) to the right of the kanban columns. Shows a proportional floor plan of the workshop with 5 zones drawn as CSS lines: (1) Pintura/Latonería — 2 slots with solid vertical center divider; (2) Lavado fila 1 — 3 cols; (3) Lavado fila 2 — 3 cols (zones 1–3 separated by dashed horizontal lines at 20% and 59%); (4) Detallado — 3 slots left col + 1 right; (5) Cuarto inferior — 2 slots left col + 1 right (separated from main body by a solid horizontal line at 80%). 15 vehicle slots total as absolute-positioned 10×10px dots; slots fill in order as vehicles arrive. Occupied slots animate in with a spring scale, empty slots show as a faint border. Counter + progress bar color: green (<10) → yellow (10–14) → red (≥15). Overflow badge shows `+N` when >15 active vehicles.
4. Plate format: uppercase alphanumeric only, max 6 chars — stripped on input with `/[^A-Z0-9]/g`.
5. Operator **not** selected during order entry — assigned at patio stage (required to start work).

## Liquidation flow

### Operator types and commission rules

Each operator has an `operator_type` that determines which service categories count for their liquidation and how commission is calculated:

| `operator_type` | Relevant categories | Commission rule |
|---|---|---|
| `detallado` | exterior, interior, ceramico, correccion_pintura | `commission_rate` % × adjusted base + ceramic bonuses. **For ceramic items**: base = Signature service price for vehicle type (automóvil $800k, camion_estandar $920k, camion_xl $1.15M) — NOT the actual ceramic price. **Ceramic application bonuses** (flat, added on top of commission): Superior Shine +2 → $60k; +5/+9/+9 EXCLUSIVE → $80k each. Non-ceramic items use standard catalog price as base. |
| `pintura` | pintura | `piece_count` × $90,000 per piece ($220k = ½ pieza, $430k = 1, $860k = 2) |
| `latoneria` | latoneria | `sum(service_orders.latoneria_operator_pay)` — manually entered at delivery, not a percentage |
| `ppf` | ppf | TBD |
| `polarizado` | polarizado | TBD |

Current operators:
- **Detallado**: Carlos Mora, Francisco Currea, Luis Lopez (commission_rate: 30%)
- **Pintura**: Jose D. Lindarte
- **Latonería**: Enrique Rodríguez

### Per-operator liquidation tracking columns

A single `service_order` can contain items from multiple operator categories (mixed orders). To allow each operator type to independently track liquidation without overwriting each other:

| `operator_type` | Column stamped on `service_orders` |
|---|---|
| `detallado` | `week_liquidation_id` |
| `pintura` | `pintura_liquidation_id` |
| `latoneria` | `latoneria_liquidation_id` |

Backend helpers in `liquidation.py`:
- `_liq_col(op_type)` → returns the correct column name
- `_get_liq_id(order, op_type)` → reads the column value
- `_is_liquidated(order, op_type, op_liq_ids)` → True if column is set and in the operator's liquidation set
- `_stamp_order(order, op_type, liq_id)` → writes the liquidation ID to the correct column

This prevents the bug where liquidating Jose (pintura) on a mixed order would overwrite Carlos's (detallado) `week_liquidation_id`, making Carlos's order reappear as unliquidated.

### `latoneria_operator_pay` on `service_orders`

Manually entered at delivery time (EstadoPatio advance to `entregado`). Shown when the order has any latoneria items. Capped at the client-facing latoneria total. Stored as `NUMERIC(12,2) NULLABLE`. Used by the latoneria liquidation endpoint as the operator's commission for that order.

### `standard_price` on `service_order_items`

The `standard_price` column stores the catalog price at order creation time (before any overrides/discounts). Used for detallado commission calculation and pintura piece counting. `unit_price` stores the actual charged price (with discounts). For orders created before the migration, `standard_price` is backfilled from `unit_price`. **For moto orders**, `standard_price` is always set to `price_automovil` (the automóvil catalog price), regardless of `price_moto`; this ensures moto detallado commissions are based on the automóvil rate ($60k / $85k).

### Liquidation API — item filtering by operator type

The liquidation endpoints (`GET /liquidation/{op_id}/week`, `POST /liquidation/{op_id}/liquidate`, `GET /liquidation/{op_id}/report`) filter order items to only those matching the operator's category via `CATEGORY_MAP`. Orders with no relevant items after filtering are excluded. Totals are recalculated from filtered items using `standard_price`. The frontend receives pre-filtered data and does not need to filter client-side.

### UI flow

1. Password gate (`BDCP123`) on every visit (uses `useState` — resets on refresh).
2. **Operator grid**: colored initials, grouped by `operator_type` section. Active operators listed first; deactivated operators shown in a separate "Dados de baja" section below.
   - **"Nuevo operario"** button opens an inline animated form (name, cédula, teléfono, comisión %). Calls `POST /operators`.
   - Deactivated operator cards are dimmed and show a "Reactivar" button. Active ones show a "Dar de baja" button with a confirmation step.
3. **Operator detail header**: inline edit form (name, phone, cedula, commission — commission hidden for non-detallado). Deactivate/Reactivate button with confirmation.
4. Operator detail: week carousel (Sun–Sat), daily accordion with filtered total + commission per day. Pintura days show piece count instead of percentage.
5. Orders with patio status `en_proceso | listo | entregado` **and at least one `is_confirmed` item** of the relevant category count. Commission is calculated from confirmed items only. For pintura operators, ALL orders with confirmed pintura items count (regardless of assigned operator).
6. **Liquidar semana** opens a modal with:
   - Abonos: input per unpaid `operario_empresa` debt — deducted from payout and recorded as `DebtPayment`
   - Settlements: toggle per unpaid `empresa_operario` debt to include in payout
   - Payment methods: 4 checkboxes (Efectivo, Banco Caja Social, Nequi, Bancolombia). One selected → auto-fills full net amount. Multiple selected → inline amount input per method, each capped so total ≤ net. If total < net → auto-creates `empresa_operario` debt for the pending amount.
   - On confirm: creates `WeekLiquidation` record, links `DebtPayment` records to it; **also auto-creates one `Expense` record per non-zero payment method** (category: "Salarios", `payment_method` = "Efectivo" | "Datáfono" | "Nequi" | "Bancolombia").
7. Post-liquidation shows payment breakdown (neto, per-method amounts, pendiente).
8. **Descargar** button opens a period picker modal:
   - "Esta semana" → calls `GET /api/v1/liquidation/{op_id}/report?period=week&ref_date=<weekStart>`
   - "Mes de X" → calls `GET /api/v1/liquidation/{op_id}/report?period=month&ref_date=<weekStart>`
     - If the selected week is in the **current month**: `de = today` (month-to-date). Label: "Mes actual (hasta hoy)"
     - If the selected week is in a **past month**: `de = last day of that month` (full month). Label: "Mes de Febrero 2026"
9. **"Otro mes"** button (Calendar icon, next to Descargar) opens a `<input type="month">` picker to generate a report for any arbitrary month.

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
- **Latoneria PDF**: commission column shows `latoneria_operator_pay` per order (not a % calculation). Labels read "Pago acordado" instead of "Comisión (X%)". Template branches on `isLatoneria` flag in `reportTemplate.ts`.
- Template extracted to `frontend/src/app/pages/liquidacion/reportTemplate.ts`; `Liquidacion.tsx` calls `printReport(r, isLatoneria)`.

## Ingresos / Egresos

- **`GET /ingresos`**: aggregates delivered `ServiceOrder` totals by 4 payment method columns + abonos from non-cancelled orders with `downpayment > 0`. `_abono_bucket()` maps `downpayment_method` to the correct bucket. Returns `daily_totals` (no date gaps) + period totals.
- **`GET /ingresos/breakdown`**: accepts `method` (cash|datafono|nequi|bancolombia), `date_start`, `date_end`. Returns list of `IngresoBreakdownItem` (order_number, date, plate, vehicle, client, amount, is_abono). Queries two sets: final payments (delivered orders where `col_attr > 0`) + abono payments (non-cancelled orders where `downpayment > 0 AND downpayment_method == label`). Sorted by date descending.
- **"Balance por método de pago"**: each payment method card shows the **balance** (ingresos − egresos) for that method, color-coded green (positive) or red (negative). Below the balance: `+$ingresos` in green, `−$egresos` in red. `egresosByMethod` useMemo groups loaded expenses by `payment_method` field (Efectivo → `payment_cash`, Datáfono → `payment_datafono`, Nequi → `payment_nequi`, Bancolombia → `payment_bancolombia`).
- **Breakdown modal (per-method)**: clicking any payment method card opens a modal with **two sections**: (1) green "Ingresos" header listing each order paid via that method (abono rows tagged with orange "Abono" badge), (2) red "Egresos" header listing all expenses for that method. Footer shows Ingresos total, Egresos total, and Balance (color-coded). Uses `METHOD_TO_LABEL` mapping to filter expenses by `payment_method` label.
- **KPI summary modals**: clicking the Ingresos, Egresos, or Balance KPI cards opens a summary modal:
  - **Ingresos**: fetches all 4 method breakdowns in parallel (`Promise.all`), merges and sorts by date, shows every payment with method badge + abono tag.
  - **Egresos**: lists all loaded expense records for the period.
  - **Balance**: 3-column summary strip (Ingresos / Egresos / Balance totals) + both lists stacked.
  - Footer shows item count + total. Period-aware — always matches the active tab (Hoy/Semana/Mes/Año).
- **`GET/POST/DELETE /egresos`**: full CRUD for manual expense records. `payment_method` field stores where money came from (Efectivo, Nequi, Bancolombia, Datáfono, Transferencia). "Banco Caja Social" is shown as label in the UI but stored as `"Datáfono"` in the DB for backward compatibility.
- **Liquidation auto-expense**: confirming a weekly liquidation auto-creates `Expense` records (category "Salarios") for the amounts paid by each method.
- **Chart granularity**: matches the active period tab — day shows a single bar, week/month show daily bars, year shows monthly bars. Both ingresos and egresos rendered side by side (green `#22c55e` / red).
- **Payment method colors**: Efectivo = green `#4ade80`, Banco Caja Social = blue `#60a5fa`, Nequi = pink `#f472b6`, Bancolombia = yellow `#eab308`.
- **Period sync**: changing the period tab recomputes `date_start`/`date_end` via `getPeriodDates()` and re-fetches both ingresos and egresos simultaneously.
- **Mobile responsive**: payment method grid is 1-col mobile / 2-col tablet / 4-col desktop. KPI cards always 3-col but compact (subtítulo hidden on mobile). Egresos table hides "Categoría" and "Método" columns on mobile. "Nuevo Egreso" button stacks below date selectors on mobile.

## Ceramicos section

- **`GET /ceramics`**: loads treatments with nested `vehicle → client` via chained `joinedload`. `CeramicVehicleOut` now includes `client?: CeramicClientOut`.
- **Page `/ceramicos`**: each treatment card shows client name (User icon) + tappable phone number (`tel:` link with Phone icon). Client block rendered between the card header and the info row, only when `vehicle.client` is present.
- Filter tabs: Todos / Vigentes / Por Vencer (<30 days) / Vencidos. `AnimatePresence mode="popLayout"` animates card shuffles.

## Clientes section

- **`GET /clients?search=`**: returns all clients ordered by name. Each record includes nested vehicles list + computed stats (`order_count`, `total_spent`, `last_service`) aggregated from all non-cancelled orders across all client vehicles.
- **`PATCH /clients/{id}`**: updates name, phone, email, invoice fields, notes.
- **Invoice fields on client**: `tipo_persona` ("natural" | "empresa"), `tipo_identificacion` (e.g. "Cédula de Ciudadanía", "NIT"), `identificacion` (ID number), `dv` (verification digit, NIT only). Stored in DB; shown/edited in the client drawer under "Datos de facturación electrónica".
- **Page `/clientes`**: KPI cards (total clients, vehicles, services), searchable list with debounced API calls, animated right drawer per client showing vehicles (with type icon), stats, invoice data, and inline edit mode.
- Clients are created implicitly by `POST /orders` (find-or-create by phone number). The `/clientes` page is read/edit only — no explicit client creation.
- **Long names**: client name uses `break-all` in both the list row and the drawer header to prevent overflow on mobile.

## Key decisions

- **API client at `src/api/index.ts`**: single `apiFetch` wrapper; all typed methods grouped by resource. `API_BASE` defaults to `http://localhost:8000/api/v1`, overridable via `VITE_API_URL` env var.
- **Prices as strings from API**: FastAPI/Pydantic v2 serializes `Decimal` as string. Always wrap with `Number()` before arithmetic — e.g. `Number(service.price_automovil)`.
- **`toLocaleString('es-CO')`**: used on all price displays for Colombian peso formatting.
- **AppContext** provides only `services`, `operators`, `loading`, and `createOrder()`. No global patio/ceramic/liquidation state — each page fetches its own data.
- **Password gate** for Liquidacion uses `useState` (not sessionStorage) — resets on page refresh.
- **`native_enum=False`** on all SQLAlchemy Enums → stored as VARCHAR. Column widths expanded to VARCHAR(30) for `category` columns after adding `correccion_pintura`.
- **`_seed_if_empty()`** reseeds services if `count != 54` (restart-to-update pattern). Operators are seeded with per-name INSERT-if-missing (not `count == 0`), so new operators can be added to the seed list without wiping existing data. 54 services span 8 categories: exterior (11), interior (9), correccion_pintura (4), ceramico (5), ppf (2), polarizado (2), pintura (11), latoneria (10).
- **Ceramic treatments**: auto-created in `POST /orders` for every `ceramico` service; `operator_id` synced on `PATCH /patio/{id}` if operator changes.
- **Week starts on Sunday** (`weekStartsOn: 0` in date-fns). `week_start` param is always the Sunday ISO date.
- **Backend API prefix**: `/api/v1/` — all routers mounted under this prefix in `main.py`.
- **`item_overrides`** in `POST /orders`: array of `{ service_id, unit_price }` that override the standard price snapshot. Used for custom discounts (any price) and warranty services (`unit_price: 0`). Backend builds `override_map` and computes discount as `sum(std - override)`.
- **Plate uniqueness**: a plate is always tied to one vehicle type and one client. On plate lookup type mismatch, the frontend blocks service selection and the "Revisar Orden" button; client info is still returned and autofilled regardless of type match.
- **Operator assignment flow**: operator is NOT selected during order entry. It is required when advancing a patio card from `esperando` → `en_proceso`. If no operator is assigned at that point, an operator-picker modal intercepts the advance: calls `PATCH /patio/{id}` to set operator (and optional `notes`), then `POST /patio/{id}/advance`. Only detallado-type operators appear in the picker. Pintura services are automatically attributed to the pintura operator via the liquidation logic (no manual assignment).
- **`operator_type`** on `operators` table: `VARCHAR(30) DEFAULT 'detallado'`. Values: `detallado`, `pintura`, `latoneria`. Determines which service categories count for the operator's liquidation and how commission is calculated.
- **`standard_price`** on `service_order_items`: stores the catalog price at order creation (before any overrides/discounts). Used by liquidation to calculate detallado commission on base prices and pintura piece counts. Backfilled from `unit_price` for historical records.
- **`CATEGORY_MAP`** in `liquidation.py`: maps `operator_type` → set of relevant `ServiceCategory` values. Used to filter items in the weekly view, liquidation, and reports. Orders with no relevant items after filtering are excluded.
- **Liquidation item filtering**: the API endpoints filter order items by operator category and use `standard_price` for totals. The frontend receives pre-filtered data — no client-side category filtering needed.
- **Ceramic commission (detallado)**: `CERAMIC_BONUSES` dict and `_signature_price()` helper in `liquidation.py`. For each ceramic item: commission base uses the "Signature" service price for the vehicle type (queried once per request), plus a flat bonus from `CERAMIC_BONUSES` keyed on `item.service_name`. `LiqWeekOrder` exposes `commission_base` (Signature-adjusted) and `ceramic_bonus` (flat bonus) per order; `LiqWeekResponse` exposes `ceramic_bonus_total`. Frontend (`LiquidarModal`, `WeekPanel`, `reportTemplate`) uses `o.commission_base ?? o.total` to maintain backward compatibility with pre-migration orders.
- **Warranty orders** (`is_warranty: true`): individual services can be marked as warranty in step 3. Warranty services are sent with `unit_price: 0` via `item_overrides`. Non-warranty services in the same order keep their normal/custom price. Total reflects only non-warranty services.
- **`getEffectivePrice` vs `getStandardPrice`** (IngresarServicio): `getEffectivePrice` checks `warrantyServiceIds` first (returns 0), then `customPrices`, then falls back to standard price. Used for totals and step 3 display. `getStandardPrice` always returns the catalog price; used for discount calculation.
- **Total display in step 3**: `totalDiscount = standardTotal - total`. When `totalDiscount > 0` shows subtotal + discount + total. When `totalDiscount <= 0` (including negative, which happens when PPF/Polarizado/Latonería custom prices exceed their $0 standard) shows simple total only.
- **`apiFetch` handles 204**: returns `undefined` without calling `res.json()` when status is 204 or `content-length: 0` — required for the DELETE /patio endpoint.
- **Patio card UX**: collapsed/expanded toggle per card (local `expanded` state inside `PatioCard`). Collapsed = minimal info; expanded = client, services, financials, edit button.
- **Service editing scope**: `PATCH /patio/{id}` with `service_ids` is accepted for `esperando` and `en_proceso`. For `listo`/`entregado` the frontend sends no `service_ids` field. `service_ids: []` (empty) is valid — sets total/subtotal to 0; use `DELETE /patio/{id}` to fully remove from kanban.
- **Cancellation flow**: removing all services + confirming in the edit modal calls `DELETE /patio/{id}` (not PATCH). The backend checks status is `esperando` or `en_proceso` before allowing deletion.
- **Payment methods on delivery**: 4 accepted methods stored as separate columns on `service_orders`: `payment_cash`, `payment_datafono`, `payment_nequi`, `payment_bancolombia`. All `Numeric(12,2) DEFAULT 0`. "Banco Caja Social" in the UI maps to `payment_datafono` in the DB. Sub-account info shown for Nequi and Bancolombia.
- **Facturación electrónica**: captured at delivery time. Stored in `localStorage` under key `bdcpolo_facturas` as `Record<orderId, FacturaRecord>`. **Also persisted to the client's DB record** via `PATCH /clients/{id}` so the form pre-fills on future orders. `FacturaRecord` = `{ tipo, id_type, id_number, dv, name, phone, email }`. Shown as a blue "FE" badge on delivered cards and a detail panel when expanded. `VehicleClientOut` in `schemas.py` includes `id, email, tipo_persona, tipo_identificacion, identificacion, dv` (loaded via `joinedload(Vehicle.client)` in both `list_patio` and `_get_entry_or_404`) so the patio API returns client factura fields without an extra request.
- **Patio notes (daños/piezas faltantes)**: `patio.notes` text field. Set via the operator-picker modal when advancing `esperando → en_proceso`. Sent as `notes` in `PATCH /patio/{id}` together with `operator_id`. Displayed as an orange ⚠ badge (collapsed) and orange panel (expanded) on the kanban card.
- **CalendarioCitas UX**: past days in month grid are dimmed (`text-gray-700`). New appointment date picker has `min=today`; edit mode has no minimum (allows changing to any date). Time picker is a `<select>` with full hours 6:00–18:00. Appointments within a day are sorted by time ascending. Field order in form: Marca → Modelo → Placa.
- **"Agregar servicio" from calendar**: appointments in `programada` or `confirmada` status show a Wrench icon button. If the appointment date ≠ today, shows a "¿Estás seguro?" confirmation modal first. Clicking (and confirming) navigates to `/` with `location.state.fromAppointment` containing vehicle/client data. IngresarServicio reads this on mount, pre-fills the form, and jumps directly to step 2 (Detallado accordion open by default). After `POST /orders` succeeds, `DELETE /appointments/{id}` is called automatically to remove the appointment. State cleared via `window.history.replaceState({}, '')` to prevent re-apply on refresh.
- **`AppointmentPatch.date` as `Optional[str]`**: Pydantic v2 name collision — field named `date` with type `Optional[date]` resolves incorrectly. Fixed by using `Optional[str]` and parsing manually in the router with `_date.fromisoformat(data['date'])`. The `date` stdlib import is aliased as `_date` in `appointments.py` to avoid the same collision.
- **Clients are find-or-create by phone**: `POST /orders` looks up an existing client by phone; if found, updates the name; if not found, creates a new one. The `/clientes` page surfaces these records.
- **Dark native date inputs**: `style={{ colorScheme: 'dark' }}` + Tailwind arbitrary variant `[&::-webkit-calendar-picker-indicator]:invert` applied to `<input type="date">` elements. Pure CSS solution — no third-party date picker needed.
- **Currency formatting helpers** (`parseCOP` / `fmtCOP`): defined per-page in IngresarServicio, EstadoPatio, Liquidacion, and IngresosEgresos. `parseCOP` strips non-digits; `fmtCOP` formats with `toLocaleString('es-CO')` (dot-separated thousands). All currency inputs use `type="text" inputMode="numeric"` — raw digits stored in state, formatted value shown in input.
- **Blocking scroll-wheel on number inputs**: `onWheel={e => e.currentTarget.blur()}` prevents accidental value changes when scrolling over `<input type="number">` fields (price editor, abono field).
- **`model_fields_set` for optional PATCH fields**: `PATCH /patio/{id}` uses `payload.model_fields_set` to detect whether `scheduled_delivery_at` was explicitly included (even as `null` to clear). Without this check, an absent field and a null field are indistinguishable.
- **`_METHOD_MAP` in ingresos router**: maps frontend method keys (`cash`, `datafono`, `nequi`, `bancolombia`) to `(db_column_attr, downpayment_method_label)` tuples. Used by both `GET /ingresos/breakdown` and the abono aggregation in `GET /ingresos`.
- **`downpayment_method` flow**: stored as VARCHAR(50) on `service_orders`. Frontend sends the UI label directly (`"Efectivo"`, `"Banco Caja Social"`, `"Nequi"`, `"Bancolombia"`). `_abono_bucket()` in `ingresos.py` maps these to the correct `payment_*` column bucket.
- **Inventory mock data**: `mockInventoryCategories` and `mockInventoryItems` in `src/data/mock.ts` use real items from the shop inventory PDF — 23 items (Área de Detallado), 18 items (Área Latonería y Pintura), plus placeholder items for Área Administrativa and Área de Limpieza. Quantities from PDF: 0.25 = quarter unit, 0.5 = half unit.
- **CalendarioCitas hour picker**: shows 6:00–18:00. IngresarServicio and patio inline delivery editor show 8:00–17:00 (operating hours).
- **`operators.py`** router: `include_inactive` query param, `POST /operators` (create), `PATCH /operators/{id}` (update fields + toggle `active`). Schemas `OperatorCreate` and `OperatorPatch` in `schemas.py`.
- **`orders.py`** duplicate check: queries for an existing non-delivered `PatioEntry` for the same vehicle before creating the order; raises HTTP 409 if found.
- **Historial PDF export**: "Descargar" button in `/historial` opens a modal with Hoy / Ayer / Elegir semana / Elegir mes options. Week/month pickers use hidden `<input type="week/month">` triggered via `useRef` + `.showPicker()`. Sends `date_from`+`date_to` to `GET /history`. PDF generated client-side as a Blob URL (same pattern as liquidation report): one row per order, services joined with `<br>`. PDF also filters out PPF/Polarizado orders when not in admin mode.
- **Historial admin lock**: PPF and Polarizado orders are hidden from both the list and PDF by default (`RESTRICTED_CATS = new Set(['ppf', 'polarizado'])`). An Eye icon button next to "Descargar" opens a minimal password modal (no title/description — just input + Cancelar/Ir). Correct password (`BDCP123`) activates admin mode: all orders visible, subtitle shows "· Modo completo", button tinted yellow. Clicking the yellow Eye button re-locks immediately. Admin state is `useState` — resets on page refresh.
- **`NO_OPERATOR_TYPES`** (EstadoPatio): `const NO_OPERATOR_TYPES = new Set(['ppf', 'polarizado'])`. Orders whose service categories are entirely in this set advance from `esperando → en_proceso` without any operator picker. The operator validation in the edit modal and the "Guardar" button also skip these types. Rationale: PPF/Polarizado are paid to third parties manually, not internal operators.
- **`week_liquidations.payment_transfer` trap**: this column has no DB-level DEFAULT in older DBs (was populated via SQLAlchemy Python-side `default=0`). After removing it from the model, INSERTs omit it and fail with `NotNullViolation` — silently caught by the `IntegrityError` handler, making liquidation appear to succeed but save nothing. Fix: `ALTER COLUMN payment_transfer SET DEFAULT 0` (already in `main.py` migrations).
- **`pendingData` stale state in Liquidacion**: `pendingData` (result of `GET /liquidation/{op_id}/pending`) must be reset to `null` when the selected operator or week changes. Without this, switching from a fully-liquidated operator leaves `unliquidated_count=0` which disables the "Liquidar semana" button for the next operator. Fixed with `setPendingData(null)` in the `useEffect([selectedOp, weekOffset])`.
- **Latoneria price validation**: `IngresarServicio` computes `latWithNoPrice` — true when any selected latoneria service has no custom price entered. Confirm button is disabled with label "Ingresa el precio de latonería" in that case.
- **Service completion checklist**: all `en_proceso` cards in EstadoPatio show interactive checkboxes always visible (outside the expanded section). When all are checked, auto-advances to `listo` (400ms delay). State driven by `is_confirmed` on `service_order_items` (persisted to DB via `PATCH /patio/{entry_id}/items/{item_id}/confirm`). Collapsed header shows animated progress bar + counter. Mobile-first design with large touch targets. "Completar" button hidden for `en_proceso`.
- **`GET /services` ORDER BY id**: services are returned in seed insertion order (by primary key) to preserve the catalog display order. Without `ORDER BY`, PostgreSQL heap order changes after `UPDATE` migrations.

## localStorage keys

| Key | Type | Purpose |
|-----|------|---------|
| `bdcpolo_facturas` | `Record<orderId, FacturaRecord>` | Facturación electrónica data per delivered order |

## Common commands

```bash
# Rebuild after dependency changes
docker compose up --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart just the backend (after Python code changes — migrations re-run on startup)
docker compose restart backend

# Open psql inside the DB container
docker compose exec db psql -U postgres -d bdcpolo

# Run a one-off Python snippet inside the backend container (useful for debugging DB state)
docker compose exec backend python -c "from app.database import SessionLocal; from app import models; db = SessionLocal(); print(db.query(models.WeekLiquidation).all()); db.close()"

# Run backend outside Docker (needs local PostgreSQL)
cd backend && python -m uvicorn app.main:app --reload --port 8000

# Run end-to-end test (backend must be running at localhost:28000)
cd backend && python test_e2e.py

# Reset DB completely (WARNING: deletes all data) then rebuild
docker compose down -v && docker compose up -d
```
