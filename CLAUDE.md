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
├── docker-compose.yml          # 3 services: db, backend, frontend
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py             # FastAPI app, mounts all routers
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── models.py           # ORM models + all enums
│   │   └── routers/            # services, operators, vehicles, orders, patio
│   └── database/
│       ├── schema.sql          # CREATE TABLE + enum types
│       └── seed.sql            # initial data (services with real prices)
└── frontend/
    ├── Dockerfile
    ├── vite.config.ts          # @tailwindcss/vite plugin, @ alias
    ├── src/
    │   ├── types/index.ts      # TypeScript interfaces mirroring DB schema
    │   ├── data/mock.ts        # mock data for local dev (no backend needed)
    │   ├── app/
    │   │   ├── routes.tsx      # createBrowserRouter, 8 pages
    │   │   ├── context/AppContext.tsx  # patio state, new order flow
    │   │   ├── components/
    │   │   │   ├── Layout.tsx          # collapsible sidebar + AnimatePresence outlet
    │   │   │   └── ui/                 # cn, Badge, Button, Input, GlassCard, Modal, etc.
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
| Backend   | FastAPI + SQLAlchemy 2.0 + psycopg2-binary + Pydantic v2 + Alembic |
| Database  | PostgreSQL 16 |
| Infra     | Docker Compose |

## Routes

| Path               | Page              | Description |
|--------------------|-------------------|-------------|
| `/`                | IngresarServicio  | 3-step wizard to create a new service order |
| `/calendario`      | CalendarioCitas   | Monthly calendar + appointment management |
| `/patio`           | EstadoPatio       | Kanban board (Esperando → En Proceso → Listo → Entregado) |
| `/inventario`      | Inventario        | Inventory management with stock levels |
| `/ceramicos`       | Ceramicos         | Ceramic treatment tracking + warranty expiry |
| `/liquidacion`     | Liquidacion       | Operator commission liquidation (password-gated: BDCP123) |
| `/ingresos-egresos`| IngresosEgresos   | Financial transactions + charts |
| `/documentos`      | Documentos        | Document management |

## Design system

- **Palette**: `gray-950` page bg → `gray-900` sidebar → `white/[0.03]` glass cards
- **Accent**: `yellow-500` / `yellow-400` for CTAs, active nav, highlights
- **Glass**: `backdrop-blur-sm` + `border border-white/8`
- **Tailwind v4**: no `tailwind.config.js`, no postcss.config — uses `@tailwindcss/vite` plugin
- **Tokens**: defined in `src/styles/theme.css` inside `@theme {}` block

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

1. **IngresarServicio**: Select vehicle type → fill form (plate required, max 6 alphanumeric; brand required; client name + phone required; operator optional) → confirm → order appears in EstadoPatio under "Esperando"
2. **EstadoPatio**: Kanban — advance card through statuses. Non-required fields (model, color, operator) can be edited here.
3. Plate format: uppercase alphanumeric only, max 6 chars (`/[^A-Z0-9]/g` stripped on input)

## Key decisions

- **No global state**: each page uses local `useState` + mock data imports
- **`sessionStorage` gate** for Liquidacion: clears on tab close, password = `BDCP123`
- **Price per vehicle type**: `service.price_automovil | price_camion_estandar | price_camion_xl`
- **Mock data in `src/data/mock.ts`**: fully cross-referenced by ID, used until backend is wired
- **Backend API prefix**: `/api/v1/` — all routers mounted under this prefix in `main.py`

## Common commands

```bash
# Rebuild after dependency changes
docker compose up --build

# View backend logs only
docker compose logs -f backend

# Restart just the backend (after Python code changes)
docker compose restart backend

# Open psql inside the DB container
docker compose exec db psql -U postgres -d bdcpolo

# Run backend outside Docker (needs local PostgreSQL)
cd backend && python -m uvicorn app.main:app --reload --port 8000
```
