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
│   │       ├── orders.py       # POST /orders (creates order + patio entry atomically)
│   │       └── patio.py        # GET /patio, POST /patio/{id}/advance, PATCH /patio/{id}
│   └── database/
│       ├── schema.sql          # CREATE TABLE + enum types (reference only, not run at boot)
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
| GET | `/services` | List active services with prices |
| GET | `/operators` | List active operators |
| GET | `/vehicles/by-plate/{plate}` | Look up vehicle by plate (pre-fills form) |
| POST | `/orders` | Create order → auto-creates patio entry in "esperando" |
| GET | `/patio` | List all patio entries with nested vehicle + order + items |
| POST | `/patio/{id}/advance` | Advance status: esperando→en_proceso→listo→entregado |
| PATCH | `/patio/{id}` | Edit vehicle model/color and/or assign operator |

## Routes

| Path               | Page              | Backend wired? | Description |
|--------------------|-------------------|----------------|-------------|
| `/`                | IngresarServicio  | ✅ | 3-step wizard → `POST /orders` |
| `/calendario`      | CalendarioCitas   | ❌ mock | Monthly calendar + appointment management |
| `/patio`           | EstadoPatio       | ✅ | Kanban fetched from `GET /patio`; advance/edit via API |
| `/inventario`      | Inventario        | ❌ mock | Inventory management with stock levels |
| `/ceramicos`       | Ceramicos         | ❌ mock | Ceramic treatment tracking + warranty expiry |
| `/liquidacion`     | Liquidacion       | ❌ mock | Operator commission liquidation (password: `BDCP123`) |
| `/ingresos-egresos`| IngresosEgresos   | ❌ mock | Financial transactions + charts |
| `/documentos`      | Documentos        | ❌ mock | Document management |

## Design system

- **Palette**: `gray-950` page bg → `gray-900` sidebar → `white/[0.03]` glass cards
- **Accent**: `yellow-500` / `yellow-400` for CTAs, active nav, highlights
- **Glass**: `backdrop-blur-sm` + `border border-white/8`
- **Tailwind v4**: no `tailwind.config.js`, no postcss.config — uses `@tailwindcss/vite` plugin
- **Tokens**: defined in `src/styles/theme.css` inside `@theme {}` block
- **Responsive**: mobile-first. Desktop has collapsible sidebar; mobile has top bar + hamburger overlay nav.

## Domain enums (mirror DB)

```
VehicleType:       automovil | camion_estandar | camion_xl
ServiceCategory:   exterior | interior | ceramico
OrderStatus:       pendiente | en_proceso | listo | entregado | cancelado
PatioStatus:       esperando | en_proceso | listo | entregado
AppointmentStatus: programada | confirmada | completada | cancelada | no_asistio
LiquidationStatus: pendiente | pagada
TransactionType:   ingreso | egreso
```

## Service order flow

1. **IngresarServicio**: Select vehicle type → fill form (plate required, max 6 alphanumeric; brand required; client name + phone required; operator optional) → confirm → `POST /api/v1/orders`
2. Backend creates: client (find or create by phone), vehicle (find or create by plate), order, order items (price snapshot), patio entry (`esperando`) — all in one transaction.
3. **EstadoPatio**: fetches `GET /api/v1/patio` on mount. Kanban cards advance via `POST /patio/{id}/advance`. Non-required fields (model, color, operator) editable via `PATCH /patio/{id}`.
4. Plate format: uppercase alphanumeric only, max 6 chars — stripped on input with `/[^A-Z0-9]/g`.

## Key decisions

- **API client at `src/api/index.ts`**: single `apiFetch` wrapper; all typed methods grouped by resource. `API_BASE` defaults to `http://localhost:8000/api/v1`, overridable via `VITE_API_URL` env var.
- **Prices as strings from API**: FastAPI/Pydantic v2 serializes `Decimal` as string. Always wrap with `Number()` before arithmetic — e.g. `Number(service.price_automovil)`.
- **AppContext** provides only `services`, `operators`, `loading`, and `createOrder()`. No local patio/order/vehicle state — each page fetches its own data.
- **Radix `Select` component** (`src/app/components/ui/Select.tsx`) used for all operator dropdowns — dark-styled, avoids OS native select appearance.
- **`sessionStorage` gate** for Liquidacion: clears on tab close, password = `BDCP123`.
- **Backend API prefix**: `/api/v1/` — all routers mounted under this prefix in `main.py`.
- **DB seeding**: done in `main.py._seed_if_empty()` on startup (checks operator count). No migration tool needed for current scope.

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
