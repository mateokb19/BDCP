# Diseño: Crédito a Clientes (Deudas del Cliente al Establecimiento)

**Fecha:** 2026-04-10  
**Estado:** Aprobado

---

## Resumen

Cuando un vehículo pasa de `listo` a `entregado` y el cliente no paga en el momento, el operario puede marcar la orden como "el cliente debe". El vehículo sale del patio normalmente. Desde la página de Clientes se puede ver qué clientes deben dinero, registrar el pago con cualquiera de los 4 métodos existentes, y generar una factura PDF consolidada de todas las deudas pendientes del cliente.

El ingreso entra a la sección de Ingresos con la **fecha de entrega del vehículo**, pero solo cuando el cliente efectivamente pague. Los operarios pueden ser liquidados desde que el carro pasa a `entregado`, independientemente del pago del cliente.

---

## 1. Base de Datos

### Nuevas columnas en `service_orders`

```sql
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS is_client_credit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS client_credit_paid_at TIMESTAMP;
```

- `is_client_credit = TRUE` — la orden fue entregada en crédito (cliente debe el restante tras abono)
- `client_credit_paid_at = NULL` — deuda pendiente; se llena con timestamp cuando el cliente paga
- Al pagar: se llenan los campos `payment_cash / payment_datafono / payment_nequi / payment_bancolombia` existentes y se pone `paid = TRUE`

### Por qué no cambia la lógica de Ingresos

La query de `GET /ingresos` suma los campos `payment_*` de órdenes con `status = entregado`. Si la orden está en crédito y sin pagar, `payment_* = 0` → contribuye $0. Cuando el cliente paga, esos campos se llenan → aparece automáticamente en Ingresos con `patio_entry.delivered_at` como fecha efectiva. No se requiere ningún cambio en el router de ingresos.

---

## 2. Backend

### Migraciones (`main.py`)

Agregar las dos sentencias `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` al bloque de migraciones idempotentes que corre en startup.

### `POST /patio/{id}/advance` — cambio menor

El endpoint de advance ya acepta un body opcional (para `payment_*` al entregar). Se agrega soporte para `is_client_credit: bool` en el body. Cuando `is_client_credit=True`:
- Pone `order.is_client_credit = True`
- Deja todos los `payment_*` en 0
- Pone `order.paid = False`
- Avanza el patio a `entregado` normalmente

### Nuevos endpoints en `clients.py`

#### `GET /clients/{id}/credits`
Retorna las órdenes del cliente donde `is_client_credit = TRUE AND client_credit_paid_at IS NULL`.

Response: lista de `ClientCreditOut`:
```
order_id, order_number, delivered_at, plate, vehicle (brand+model), services (names joined), amount (restante = total - downpayment)
```

#### `POST /clients/{id}/credits/pay`
Body: `{ payment_cash, payment_datafono, payment_nequi, payment_bancolombia }`

Validaciones:
- La suma de los 4 métodos debe ser >= el total de deudas pendientes del cliente (HTTP 400 si no)
- El total de métodos no puede exceder el total de deudas (HTTP 400)

Lógica:
1. Carga todas las órdenes pendientes del cliente ordenadas por `delivered_at ASC`
2. Distribuye el pago proporcionalmente entre las órdenes (cada orden recibe su fracción del total según su peso en el total)
3. Marca cada orden: `client_credit_paid_at = now()`, `paid = True`, llena `payment_*`
4. Retorna lista actualizada (vacía — todas pagadas)

### Schemas nuevos (`schemas.py`)

```python
class ClientCreditOut(BaseModel):
    order_id: int
    order_number: str
    delivered_at: str
    plate: str
    vehicle: str
    services: str
    amount: float

class ClientCreditPayment(BaseModel):
    payment_cash: float = 0
    payment_datafono: float = 0
    payment_nequi: float = 0
    payment_bancolombia: float = 0
```

---

## 3. EstadoPatio — Modal de entrega (listo → entregado)

### Trigger

Solo aparece cuando `restante > 0` (hay saldo pendiente después del abono).

### UI

En el modal de pago actual, debajo de los checkboxes de método de pago, se agrega un botón pequeño y discreto:

```
[ El cliente debe este valor ]
```

Al hacer clic entra en un sub-estado de confirmación dentro del mismo modal:

- Muestra: *"¿Confirmar que el cliente debe $X,XXX? El vehículo saldrá del patio."*
- Dos acciones: **Cancelar** (vuelve al estado normal del modal) / **Confirmar deuda**
- Al confirmar: llama `POST /patio/{id}/advance` con `{ is_client_credit: true }`, sin `payment_*`
- El vehículo desaparece del kanban igual que en una entrega normal

### Sin efecto en liquidación

La liquidación de operarios ya funciona en base a `is_confirmed` en los items y el status `entregado`. Este flujo no cambia nada de eso.

---

## 4. Página de Clientes

### Lista de clientes

- Badge rojo en las filas de clientes con deudas pendientes: `Debe $130,000`
- El badge se calcula desde `GET /clients` — se agrega campo `pending_credit_total: float` al schema `ClientOut` (0 si no debe nada)

### KPI cards

Se agrega una cuarta tarjeta: **"Con deuda"** — conteo de clientes con `pending_credit_total > 0`.

### Drawer del cliente

Nueva sección **"Deudas pendientes"** (visible solo si `pending_credit_total > 0`):

| Columna | Contenido |
|---|---|
| Orden | `order_number` |
| Entrega | `delivered_at` formateado |
| Placa | `plate` |
| Monto | `amount` en pesos COP |

- Fila de **Total** al pie de la tabla
- Botón **"Registrar pago"** → abre modal de pago
- Botón **"Descargar factura"** → genera PDF

### Modal de pago (desde Clientes)

Mismo patrón que el modal de entrega en EstadoPatio:
- 4 checkboxes: Efectivo, Banco Caja Social, Nequi, Bancolombia
- Un método seleccionado → monto total automático
- Varios métodos → input por método con indicador de balance
- Confirmar → `POST /clients/{id}/credits/pay` → toast de éxito → drawer se actualiza (sección de deudas desaparece)

### PDF de factura de deudas

Mismo patrón que los PDFs existentes (Blob URL generado en frontend, `body onload="window.print()"`):

```
Encabezado:
  BDCPolo logo (izq) | "Factura de Servicios Pendientes" + fecha generación (der)

Sección cliente:
  Nombre, Teléfono

Tabla de órdenes:
  Orden | Fecha Entrega | Placa | Vehículo | Servicios | Monto

Totales:
  Total a pagar: $XXX,XXX

Pie:
  Bogotá Detailing Center · BDCPolo · Comprobante interno
```

- Todos los strings pasan por `escapeHtml()` antes de insertar en HTML
- Precios con `Number(n).toLocaleString('es-CO')`
- Template extraído a archivo separado (patrón del `reportTemplate.ts` de liquidación)

---

## 5. Cambios en `GET /clients`

Para soportar el badge y el KPI sin un endpoint extra, se agrega a la query existente:

```python
pending_credit_total = sum(
    float(o.total) - float(o.downpayment)
    for v in c.vehicles
    for o in v.orders
    if o.is_client_credit and o.client_credit_paid_at is None
)
```

Se agrega `pending_credit_total: float` al schema `ClientOut`.

---

## 6. Flujo completo end-to-end

```
1. Vehículo llega a "listo" → operario hace clic en avanzar
2. Modal de entrega abre (restante > 0)
3. Operario hace clic en "El cliente debe este valor"
4. Confirmación → POST /patio/{id}/advance { is_client_credit: true }
5. Vehículo sale del patio (entregado), order.is_client_credit = TRUE, payment_* = 0
6. Operario puede ser liquidado normalmente
7. [ingresos: orden entregada con payment_* = 0 → contribuye $0]

8. Cliente regresa para pagar
9. Recepcionista abre /clientes, encuentra al cliente (badge rojo)
10. Abre drawer → sección "Deudas pendientes"
11. Opcionalmente descarga PDF de factura
12. Hace clic en "Registrar pago"
13. Selecciona métodos y montos → POST /clients/{id}/credits/pay
14. Órdenes se marcan como pagadas, payment_* llenados
15. [ingresos: órdenes ahora tienen payment_* > 0 → aparecen con fecha de entrega original]
16. Badge rojo desaparece del cliente
```

---

## 7. Archivos a modificar / crear

| Archivo | Cambio |
|---|---|
| `backend/app/main.py` | 2 migraciones ALTER TABLE |
| `backend/app/models.py` | 2 columnas en `ServiceOrder` |
| `backend/app/schemas.py` | `ClientCreditOut`, `ClientCreditPayment`, `pending_credit_total` en `ClientOut` |
| `backend/app/routers/patio.py` | Soporte `is_client_credit` en advance body |
| `backend/app/routers/clients.py` | `GET /{id}/credits`, `POST /{id}/credits/pay`, `pending_credit_total` en `_build_client_out` |
| `frontend/src/api/index.ts` | Métodos `clients.getCredits()`, `clients.payCredits()` |
| `frontend/src/types/index.ts` | `ClientCreditItem`, `pending_credit_total` en `ApiClient` |
| `frontend/src/app/pages/EstadoPatio.tsx` | Botón + confirmación en modal de entrega |
| `frontend/src/app/pages/Clientes.tsx` | Badge, KPI, sección deudas en drawer, modal pago, PDF |
| `frontend/src/app/pages/clientes/creditInvoiceTemplate.ts` | Template HTML del PDF (nuevo archivo) |
