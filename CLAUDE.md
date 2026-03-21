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
| PATCH  | `/patio/{id}` | Edit color, assign operator, add/remove services; syncs operator to ceramic_treatments |
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
| `/calendario`      | CalendarioCitas   | ❌ mock | Monthly calendar + appointment management |
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

## Service order flow

1. **IngresarServicio**: Select vehicle type → fill form (plate required, max 6 alphanumeric; brand required; client name + phone required; operator optional) → confirm → `POST /api/v1/orders`
2. Backend creates atomically: client (find or create by phone), vehicle (find or create by plate), order, order items (price snapshot), patio entry (`esperando`). If any item is `ceramico` category, also creates a `CeramicTreatment` record with `next_maintenance = application_date + 6 months`.
3. **EstadoPatio**: fetches `GET /api/v1/patio` on mount. Kanban cards advance via `POST /patio/{id}/advance`. Color, operator, and services editable via `PATCH /patio/{id}`. Operator change syncs to `ceramic_treatments` for that order.
4. Plate format: uppercase alphanumeric only, max 6 chars — stripped on input with `/[^A-Z0-9]/g`.

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
