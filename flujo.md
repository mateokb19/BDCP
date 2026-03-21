# Flujo de la Aplicación BDCPolo

Sistema de gestión para **Bogotá Detailing Center**. Full-stack: React/Vite frontend + FastAPI backend + PostgreSQL en Docker.

---

## Arquitectura general

```
Usuario (navegador)
    ↓ HTTP
Frontend React/Vite  →  src/api/index.ts  →  FastAPI backend  →  PostgreSQL
  (puerto 5173)            apiFetch()           (puerto 8000)      (puerto 5432)
```

El frontend consume la API bajo `/api/v1/`. Todo el estado de servidor es local a cada página (no hay store global excepto `AppContext` que provee servicios y operarios).

---

## AppContext

**Archivo:** `frontend/src/app/context/AppContext.tsx`

Se carga una sola vez al montar la app. Provee a todas las páginas:
- `services[]` — lista de servicios activos con precios por tipo de vehículo
- `operators[]` — lista de operarios activos
- `loading` — booleano mientras cargan ambas listas
- `createOrder(payload)` — llama `POST /api/v1/orders` y retorna la orden creada

---

## Páginas y flujos

### 1. Ingresar Servicio (`/`)
**Archivo:** `IngresarServicio.tsx` | **Backend:** ✅ conectado

Wizard de 3 pasos:

```
Paso 1 — Tipo de vehículo
  └─ Seleccionar: Automóvil / Camión Estándar / Camión XL

Paso 2 — Datos del vehículo y cliente
  ├─ Placa (máx 6 chars alfanuméricos, se busca en GET /vehicles/by-plate/{plate})
  │    └─ Si existe → pre-rellena marca, modelo, color y datos del cliente
  ├─ Marca (selector de 26 marcas) + Modelo (selector dinámico según marca)
  ├─ Color (opcional)
  ├─ Nombre del cliente (requerido)
  ├─ Teléfono del cliente (requerido, solo números y +)
  └─ Operario asignado (opcional, desde AppContext.operators)

Paso 3 — Selección de servicios
  ├─ Servicios agrupados por categoría (exterior / interior / cerámico / corrección pintura)
  ├─ Precio mostrado según el tipo de vehículo del Paso 1
  └─ Botón "Revisar Orden" → scroll al top de la siguiente vista

Confirmación — Resumen de la orden
  └─ Botón "Confirmar" → POST /api/v1/orders
       Backend crea (en una sola transacción):
         - Cliente (find-or-create por teléfono)
         - Vehículo (find-or-create por placa)
         - ServiceOrder con items (snapshot de precio)
         - PatioEntry en estado "esperando"
       → Toast de éxito → resetea wizard al Paso 1
```

---

### 2. Estado del Patio (`/patio`)
**Archivo:** `EstadoPatio.tsx` | **Backend:** ✅ conectado

Vista Kanban con 4 columnas de estado:

```
esperando → en_proceso → listo → entregado
```

Al montar: `GET /api/v1/patio`
- Solo muestra entradas `entregado` del día actual (las de días anteriores se ocultan automáticamente al inicio de cada día — reset diario no destructivo).

Acciones por card:
- **Avanzar estado** → `POST /api/v1/patio/{id}/advance`
- **Editar** (modelo, color, operario, notas) → `PATCH /api/v1/patio/{id}`

---

### 3. Historial (`/historial`)
**Archivo:** `Historial.tsx` | **Backend:** ✅ conectado

```
Filtros (en la parte superior, full-width mobile-first):
  ├─ Date picker (default = hoy)  → GET /api/v1/history?date_filter=YYYY-MM-DD
  └─ Buscador (debounce 350ms)   → &search=texto  (busca en placa, nombre, orden)

Lista de cards — una por orden de servicio:
  ├─ Número de orden + estado + total
  ├─ Marca/modelo · placa · color
  ├─ Cliente + teléfono | Operario
  ├─ Badges de servicios (grid 2 columnas, texto truncado)
  └─ "Ver detalle" (expandible) → lista de items con precio unitario y subtotal

Resumen del día: contador de servicios + total acumulado en el subtitle del header.
```

---

### 4. Calendario de Citas (`/calendario`)
**Archivo:** `CalendarioCitas.tsx` | **Backend:** ❌ mock

Vista mensual + lista de citas del día seleccionado. Los datos vienen de `src/data/mock.ts`. No persiste cambios en backend.

---

### 5. Inventario (`/inventario`)
**Archivo:** `Inventario.tsx` | **Backend:** ❌ mock

```
Filtros: categorías en strip deslizante (mobile) / tabs (desktop)
Tabla de items:
  ├─ Nombre + barra de stock (debajo del nombre en mobile)
  ├─ Stock actual vs. stock mínimo
  └─ Botón "Editar" a la derecha
Modal "Agregar/Editar item":
  └─ Selector de categoría con estilo dark (Radix Select)
```

Datos de `src/data/mock.ts`. No persiste.

---

### 6. Cerámicos (`/ceramicos`)
**Archivo:** `Ceramicos.tsx` | **Backend:** ✅ parcial (ceramics router existe)

```
Filtros: strip deslizante con categorías (mobile)
Cards: grid 1 columna (mobile) / 2-3 columnas (desktop)
  ├─ Placa + marca/modelo + cliente
  ├─ Tipo de tratamiento + fecha de aplicación
  ├─ Próximo mantenimiento (con indicador de vencimiento)
  └─ Operario que aplicó

GET /api/v1/ceramics (si está montado) o datos mock.
```

---

### 7. Liquidación (`/liquidacion`)
**Archivo:** `Liquidacion.tsx` | **Backend:** ✅ conectado

**Requiere contraseña `BDCP123` en cada visita** (no persiste en sessionStorage).

```
Pantalla de lock → formulario de contraseña

Grid de operarios → seleccionar uno

Vista de operario seleccionado:
  ├─ Header: nombre, comisión %, teléfono, cédula
  ├─ Navegador de semanas (← semana → hasta semana actual)
  │    GET /api/v1/liquidation/{op_id}/week?week_start=YYYY-MM-DD
  ├─ KPIs de la semana: servicios · total bruto · comisión
  │
  ├─ Si semana NO liquidada:
  │    └─ Botón "Liquidar semana" → modal LiquidarModal
  │         ├─ Abonos de deudas del operario (ajuste negativo)
  │         ├─ Deudas empresa→operario a incluir (ajuste positivo)
  │         ├─ Resumen: comisión - abonos + deudas incluidas = neto
  │         ├─ Método de pago:
  │         │    ├─ Botones rápidos: "Todo transferencia" / "Todo efectivo"
  │         │    ├─ Input transferencia (máx = neto - efectivo actual)
  │         │    └─ Input efectivo (máx = neto - transferencia actual)
  │         └─ POST /api/v1/liquidation/{op_id}/liquidate
  │
  ├─ Si semana YA liquidada:
  │    └─ Badge "Semana liquidada" + desglose de pago (neto / transferencia / efectivo / pendiente)
  │
  ├─ Acordeón por día: servicios del día expandibles
  │    └─ Cada orden: número, vehículo, placa, items, total
  │
  └─ Sección de deudas:
       ├─ "Registrar deuda" → form inline (dirección + monto + descripción)
       │    POST /api/v1/liquidation/{op_id}/debts
       ├─ Deudas pendientes (operario → empresa): con botón "Pagada"
       │    PATCH /api/v1/liquidation/debts/{debt_id}/paid
       └─ Deudas pagadas (colapsadas en <details>)
```

---

### 8. Ingresos y Egresos (`/ingresos-egresos`)
**Archivo:** `IngresosEgresos.tsx` | **Backend:** ❌ mock

```
KPIs: ingresos totales / egresos totales / balance (grid 2 cols en mobile)
Filtros: rango de fechas (stacked en mobile) + botones de tipo (ingreso/egreso/todos)
Gráfico de barras (Recharts, ResponsiveContainer)
Lista de transacciones:
  └─ Punto verde (ingreso) o rojo (egreso) · descripción · monto · fecha
```

---

### 9. Documentos (`/documentos`)
**Archivo:** `Documentos.tsx` | **Backend:** ❌ mock

```
Buscador + filtros de tipo (flex-wrap en mobile)
Grid de cards de documentos
Modal "Subir documento":
  ├─ Selector "Tipo" con estilo dark (Radix Select)
  └─ Selector "Relacionado con" con estilo dark (Radix Select)
```

---

## Flujo de datos API

```
Frontend (api/index.ts)
│
├─ GET  /api/v1/services              → AppContext (carga al inicio)
├─ GET  /api/v1/operators             → AppContext (carga al inicio)
├─ GET  /api/v1/vehicles/by-plate/:p  → IngresarServicio (paso 2, búsqueda por placa)
├─ POST /api/v1/orders                → IngresarServicio (confirmar orden)
│
├─ GET  /api/v1/patio                 → EstadoPatio (solo entregados de hoy)
├─ POST /api/v1/patio/:id/advance     → EstadoPatio (avanzar estado)
├─ PATCH /api/v1/patio/:id            → EstadoPatio (editar modelo/color/operario)
│
├─ GET  /api/v1/history               → Historial (con date_filter y search)
│
├─ GET  /api/v1/ceramics              → Ceramicos
│
├─ GET  /api/v1/liquidation/:op/week  → Liquidacion (datos de semana)
├─ POST /api/v1/liquidation/:op/liquidate → Liquidacion (confirmar liquidación)
├─ GET  /api/v1/liquidation/:op/debts → Liquidacion (deudas del operario)
├─ POST /api/v1/liquidation/:op/debts → Liquidacion (crear deuda)
└─ PATCH /api/v1/liquidation/debts/:id/paid → Liquidacion (marcar deuda pagada)
```

---

## Reset diario del patio

`GET /api/v1/patio` filtra con:
```sql
WHERE status != 'entregado'
   OR DATE(delivered_at) = CURRENT_DATE
```
Cada día nuevo la columna "Entregados" aparece vacía automáticamente. Los datos históricos están disponibles en `/historial`.

---

## Modelos de dominio principales

```
Client ──< Vehicle ──< ServiceOrder ──< ServiceOrderItem
                           │
                           ├── Operator (asignado a la orden)
                           └── PatioEntry (1:1, estado en el patio)

Operator ──< WeekLiquidation
          ──< Debt ──< DebtPayment

Vehicle ──< CeramicTreatment
```

---

## Responsive (mobile-first, 390px)

- Sidebar oculto en mobile, reemplazado por top bar + hamburger overlay
- `isMobile` se inicializa con `window.innerWidth < 768` para evitar `marginLeft: 64px` en el primer render
- `overflow-x-hidden` en el contenedor raíz del Layout
- Todas las páginas usan `grid-cols-1` por defecto, escalando a 2-3 cols en `sm:`/`md:`/`lg:`
- Badges de servicios en Historial: `grid-cols-2` (máximo 2 por fila, texto truncado)
