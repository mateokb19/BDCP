# BDCPolo — Car Wash Management System

Sistema de gestión para **Bogotá Detailing Center**. Permite registrar servicios, controlar el estado del patio, gestionar inventario, hacer seguimiento de cerámicos, liquidar operarios y visualizar ingresos/egresos.

---

## Stack

| Capa       | Tecnología |
|------------|-----------|
| Frontend   | React 18 + TypeScript, Vite 6, Tailwind CSS v4, Framer Motion |
| UI         | Radix UI, lucide-react, recharts, sonner |
| Backend    | FastAPI + SQLAlchemy 2.0 + Pydantic v2 |
| Base de datos | PostgreSQL 16 |
| Infra      | Docker Compose |

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo

---

## Cómo correr el proyecto

**Primera vez** (construye imágenes y siembra la base de datos):
```bash
docker compose up --build
```

**Siguientes veces:**
```bash
docker compose up
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend / Swagger | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

Credenciales de la base de datos: usuario `postgres`, contraseña `bdcpolo123`, base de datos `bdcpolo`.

---

## Páginas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Ingresar Servicio | Wizard de 3 pasos para registrar un vehículo y sus servicios |
| `/patio` | Estado del Patio | Kanban con el estado de cada vehículo en el patio |
| `/calendario` | Calendario de Citas | Vista mensual de citas programadas |
| `/inventario` | Inventario | Gestión de productos con niveles de stock |
| `/ceramicos` | Cerámicos | Seguimiento de tratamientos cerámicos y vencimiento de garantías |
| `/liquidacion` | Liquidación | Comisiones por operario — requiere contraseña `BDCP123` |
| `/ingresos-egresos` | Ingresos y Egresos | Transacciones financieras y gráficas |
| `/documentos` | Documentos | Gestión de documentos |

---

## API — Endpoints principales

Todos los endpoints están bajo el prefijo `/api/v1/`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/services` | Lista servicios activos con precios |
| GET | `/operators` | Lista operarios activos |
| GET | `/vehicles/by-plate/{plate}` | Busca vehículo por placa |
| POST | `/orders` | Crea orden + entrada en el patio automáticamente |
| GET | `/patio` | Lista entradas del patio con detalles |
| POST | `/patio/{id}/advance` | Avanza el estado: esperando → en proceso → listo → entregado |
| PATCH | `/patio/{id}` | Edita modelo/color del vehículo u asigna operario |

Documentación interactiva completa en http://localhost:8000/docs.

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar solo el backend (después de cambios en Python)
docker compose restart backend

# Abrir consola de PostgreSQL
docker compose exec db psql -U postgres -d bdcpolo

# Reconstruir después de cambiar dependencias
docker compose up --build
```

---

## Estructura del proyecto

```
BDCP/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # App principal, siembra la BD al iniciar
│       ├── database.py      # Conexión SQLAlchemy
│       ├── models.py        # Modelos ORM + enums
│       ├── schemas.py       # Schemas Pydantic v2
│       └── routers/         # Un archivo por recurso
└── frontend/
    ├── Dockerfile
    └── src/
        ├── api/index.ts     # Cliente HTTP tipado
        ├── types/index.ts   # Interfaces TypeScript
        └── app/
            ├── routes.tsx
            ├── context/     # AppContext global
            ├── components/  # Layout + componentes UI
            └── pages/       # 8 páginas
```
