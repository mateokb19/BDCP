# 🚗 Bogotá Detailing Center — Sistema de Gestión Integral

> **BDCPolo**: La solución todo-en-uno para la gestión de tu lavadero y detallado de vehículos en Bogotá.

---

## 📋 ¿Qué es BDCPolo?

**Bogotá Detailing Center** es una plataforma de gestión integral diseñada específicamente para lavaderos, detallados y servicios automotrices. Permite:

✅ **Registrar y controlar órdenes de servicio** — Desde que entra el vehículo hasta que se entrega  
✅ **Agendar citas automáticamente** — Los clientes reservan desde WhatsApp y aparece en el calendario  
✅ **Gestionar el flujo del patio** — Visualiza qué vehículos están esperando, en proceso, listos o entregados  
✅ **Calcular comisiones por operario** — Liquidaciones automáticas con detalles de servicios y pagos  
✅ **Control de ingresos y gastos** — Análisis financiero por método de pago (efectivo, datafono, Nequi, Bancolombia)  
✅ **Seguimiento de cerámicos** — Garantías de tratamientos cerámicos con alertas de vencimiento  
✅ **Base de datos de clientes** — Historial de servicios, vehículos y estadísticas por cliente  

---

## 🎯 Características Principales

### 1. **Registro Rápido de Servicios** 
Wizard intuitivo de 3 pasos:
- Seleccionar tipo de vehículo (moto, automóvil, camioneta)
- Ingresar datos del vehículo y servicios deseados
- Revisar total, descargas (abonos) y confirmar orden

Los precios se calculan automáticamente según el vehículo y el tipo de servicio.

### 2. **Kanban en Tiempo Real**
Visualiza el estado de todos los vehículos en el patio:
- **Esperando**: Pendiente de ser asignado a un operario
- **En proceso**: Siendo lavado/detallado
- **Listo**: Completado y listo para entrega
- **Entregado**: Fuera del patio

Con un simple tap, marca cada servicio como completado → el vehículo avanza automáticamente.

### 3. **Calendario de Citas**
- Vista mensual interactiva
- Agendar citas directamente desde la app
- Información del vehículo, cliente y servicios
- Integración con WhatsApp Bot (próximamente: citas desde mensajes)

### 4. **Gestión de Operarios**
- Crear y gestionar operarios por tipo (Detallado, Pintura, Latonería)
- Asignación automática cuando es posible
- Historial de servicios por operario
- Panel de deactivación/reactivación

### 5. **Liquidación Semanal**
Sistema automático de liquidaciones:
- **Cálculo de comisiones** por operario según tipo de servicio
- **Tratamientos cerámicos**: Base en precio catálogo + bonos planos
- **Pintura**: Pago por pieza ($220k = ½ pieza, $430k = 1 pieza, etc.)
- **Latonería**: Pago acordado manualmente
- **Descuentos por abonos** (deudas operario-empresa)
- **Payout por método**: Efectivo, Banco Caja Social, Nequi, Bancolombia
- **Reporte PDF** con detalle de servicios y comisión

### 6. **Análisis Financiero**
Dashboard completo de **Ingresos y Egresos**:
- Balance diario, semanal, mensual y anual
- Desglose por método de pago
- Gráficas comparativas ingresos vs gastos
- Registro manual de gastos (categoría, método, fecha)
- Totales y tendencias en tiempo real

### 7. **Cerámicos y Garantías**
Seguimiento automático de tratamientos:
- Auto-creación al registrar servicio de cerámica
- Fecha de aplicación + siguiente mantenimiento (6 meses)
- Filtros: Todos, Vigentes, Por Vencer (<30 días), Vencidos
- Contact card del cliente con teléfono directo

### 8. **Base de Datos de Clientes**
Panel de gestión de clientes:
- Búsqueda rápida por nombre
- Lista de vehículos asociados
- Estadísticas: órdenes totales, gasto total, último servicio
- Edición de datos de facturación electrónica (RUT, CI, email)
- Historial completo de servicios

### 9. **Historial de Órdenes**
Búsqueda y filtrado histórico:
- Buscar por placa, cliente, número de orden
- Filtro por rango de fechas
- **Descargar PDF** del historial
- Modo admin: Ver órdenes de PPF/Polarizado (protegidas)

---

## 🚀 Cómo Empezar

### Requisitos
- Docker Desktop instalado ([Descargar](https://www.docker.com/products/docker-desktop/))

### Primera ejecución
```bash
docker compose up --build
```

### Acceso
| Servicio | URL |
|----------|-----|
| **App Web** | http://localhost:28001 |
| **API (Swagger)** | http://localhost:28000/docs |
| **Base de Datos** | localhost:54321 |

**Credenciales DB**: usuario `postgres` / contraseña `bdcpolo123` / base `bdcpolo`

### Siguientes veces
```bash
docker compose up
```

---

## 📱 Servicios Disponibles

### Categorías principales
- **Detallado**: Exterior, Interior, Corrección, Cerámico
- **Latonería**: Reparación de piezas metálicas
- **Pintura**: Repintado (½ pieza, 1 pieza, 2 piezas)
- **PPF** (Paint Protection Film): Protección transparente
- **Polarizado**: Instalación de láminas
- **Otros**: PDR, arreglo de rines, lavado motor/chasis

Todos con **precios diferenciados por tipo de vehículo**:
- Motos: Servicios limitados (exterior)
- Automóviles: Catálogo completo
- Camionetas estándar y XL: Precios especiales

---

## 💰 Métodos de Pago

Se aceptan 4 métodos de pago:
1. **Efectivo** 💵
2. **Banco Caja Social** (vía datáfono) 🏦
3. **Nequi** (3118777229 / @NEQUIJUL11739) 📱
4. **Bancolombia Ahorros** (60123354942 / @SaraP9810) 💳

### Abonos (Pagos Parciales)
- Permite abonar cantidad parcial al registrar orden
- Diferencia se cobra al entregar
- Método de abono se guarda en el registro

---

## 📊 Pantallas y Funcionalidades

| Pantalla | Función |
|----------|---------|
| 🏠 **Ingresar Servicio** | Registrar orden (3 pasos: tipo vehículo → datos → revisar) |
| 📍 **Patio** | Kanban con estado de vehículos, checklist de servicios |
| 📅 **Calendario** | Citas programadas, edición, eliminación |
| 📦 **Inventario** | Niveles de stock de productos (en desarrollo) |
| 🛡️ **Cerámicos** | Tratamientos con garantía, alertas de vencimiento |
| 💼 **Liquidación** | Comisiones semanales por operario (requiere clave) |
| 💹 **Ingresos/Egresos** | Análisis financiero con gráficas |
| 📄 **Documentos** | Gestión de archivos (en desarrollo) |
| 👥 **Clientes** | Base de datos con historial y estadísticas |
| 📜 **Historial** | Búsqueda y descarga PDF de órdenes |

---

## 🔐 Seguridad

- **Liquidación**: Protegida con clave 
- **Modo Admin**: Acceso a órdenes PPF/Polarizado requiere clave
- **Datos**: Almacenados en PostgreSQL con backup automático
- **HTTPS**: Recomendado en producción (no configurado por defecto)

---

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar backend (p. ej. después de cambios)
docker compose restart backend

# Abrir consola de base de datos
docker compose exec db psql -U postgres -d bdcpolo

# Recrear base de datos (borra todo)
docker compose down -v && docker compose up -d
```

---

## 👨‍💻 Para Desarrolladores

### Stack Tecnológico
| Capa | Tech |
|------|------|
| **Frontend** | React 18 + TypeScript, Vite 6, Tailwind CSS v4, Framer Motion |
| **UI** | Radix UI, Lucide Icons, Recharts, Sonner Toasts, date-fns |
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| **Base de Datos** | PostgreSQL 16 |
| **Infra** | Docker Compose |

### API Endpoints
Todos bajo `/api/v1/`:
- `GET /services` — Servicios activos
- `GET /operators` — Operarios
- `POST /orders` — Crear orden
- `GET /patio` — Estado patio
- `PATCH /patio/{id}` — Editar patio
- `GET /appointments` — Citas
- `POST /appointments` — Agendar cita
- Más endpoints en http://localhost:28000/docs

### Documentación técnica
Ver **CLAUDE.md** para:
- Arquitectura completa
- Flujos de negocio
- Estructuras de datos
- Decisiones técnicas

---

## 📞 Contacto y Soporte

**Bogotá Detailing Center**
- 📧 Email: nicolasdrr25@gmail.com
- 🌍 Ubicación: Bogotá, Colombia
- ⏰ Horarios: Lunes-Domingo, 6:00 AM - 6:00 PM

---

## 📈 Roadmap

- ✅ Gestión de órdenes y patio
- ✅ Liquidación de operarios
- ✅ Calendario de citas
- ✅ Análisis financiero
- 🔄 **En Progreso**: Bot de WhatsApp para agendamiento automático
- ⏳ **Próximamente**: Inventario completo, Facturación electrónica, Reportes avanzados

---

## 📄 Licencia

Uso interno para Bogotá Detailing Center. Todos los derechos reservados.

---

**Última actualización**: Abril 2026  
**Versión**: 1.0  
**Estado**: En producción ✅
