# BDCPolo - Diagrama de Entidad-Relación

## Tablas y relaciones

```
clients (1) ──────────────────── (N) vehicles
                                       │
                                       │ (1)
                                       │
appointments ─── appointment_services  │
     │                                 │
     │ (1:1, opcional)                 │
     ▼                                 ▼
service_orders ◄──────────────────────(N)
     │    │
     │    └──── service_order_items ──► services
     │    └──── patio
     │    └──── ceramic_treatments
     │    └──── transactions (ingreso al pagar)
     │    └──── liquidation_orders
     │    └──── inventory_movements
     │    └──── documents
     │
operators ──── service_orders (N)
     │
     └────────── liquidations
     └────────── ceramic_treatments
     └────────── users (1:1 opcional)
```

## Descripción por módulo

### Ingresar Servicio → `service_orders` + `service_order_items`
- Se busca o crea el `vehicle` (por placa).
- Si el vehículo no tiene `client_id`, los datos del cliente quedan en el propio registro del vehículo (o se crea un cliente).
- Cada servicio seleccionado genera un `service_order_item` con snapshot de nombre y precio.
- Al guardar la orden se crea un registro en `patio` con status `esperando`.

### Calendario de Citas → `appointments` + `appointment_services`
- La cita guarda datos mínimos del vehículo (sin requerir que exista en `vehicles`).
- Al confirmar la llegada del vehículo, la cita genera una `service_order` y se vincula vía `order_id`.

### Estado de Patio → `patio`
- Vista en tiempo real del estado de cada orden activa.
- Transiciones: `esperando → en_proceso → listo → entregado`.
- `position` indica el puesto físico en el patio.

### Inventario → `inventory_items` + `inventory_movements`
- Cada uso de un insumo en una orden genera un `inventory_movement` (salida).
- Las compras generan movimientos de entrada.
- Alerta cuando `quantity <= min_stock`.

### Cerámicos → `ceramic_treatments`
- Registro detallado de cada tratamiento cerámico aplicado.
- Calcula `warranty_expiry = application_date + warranty_months`.
- Historial por vehículo para consulta de garantía.

### Liquidación → `liquidations` + `liquidation_orders`
- Agrupa las órdenes de un operario en un periodo.
- Calcula comisión con la tasa del momento (`commission_rate` snapshot).
- Estados: `pendiente` → `pagada`.

### Ingresos/Egresos → `transactions`
- Las órdenes pagadas generan automáticamente un `ingreso`.
- Los egresos (compras de insumos, salarios) se registran manualmente.
- Permite filtrar por tipo, categoría y rango de fechas.

### Documentos → `documents`
- Relación polimórfica: un documento puede pertenecer a una orden, vehículo, cliente o ser general.
- Almacena la ruta del archivo en el servidor.

## Enums

| Enum | Valores |
|---|---|
| `vehicle_type` | `automovil`, `camion_estandar`, `camion_xl` |
| `service_category` | `exterior`, `interior`, `ceramico` |
| `order_status` | `pendiente`, `en_proceso`, `listo`, `entregado`, `cancelado` |
| `patio_status` | `esperando`, `en_proceso`, `listo`, `entregado` |
| `appointment_status` | `programada`, `confirmada`, `completada`, `cancelada`, `no_asistio` |
| `transaction_type` | `ingreso`, `egreso` |
| `liquidation_status` | `pendiente`, `pagada` |
| `user_role` | `admin`, `recepcion`, `operario` |
```
