import type {
  Client, Vehicle, Operator, Service, ServiceOrder, ServiceOrderItem,
  Appointment, AppointmentService, PatioEntry, InventoryCategory,
  InventoryItem, CeramicTreatment, Liquidation, LiquidationOrder,
  Transaction, Document,
} from '@/types'

// ---- CLIENTS ----
export const mockClients: Client[] = [
  { id: 1, name: 'Juan Pérez',      phone: '555-1234', email: 'juan@email.com',  created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z' },
  { id: 2, name: 'María González',  phone: '555-5678', email: 'maria@email.com', created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z' },
  { id: 3, name: 'Carlos Rodríguez',phone: '555-9012', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
  { id: 4, name: 'Ana Martínez',    phone: '555-3456', email: 'ana@email.com',   created_at: '2026-02-10T00:00:00Z', updated_at: '2026-02-10T00:00:00Z' },
  { id: 5, name: 'Roberto Silva',   phone: '555-7890', created_at: '2026-02-20T00:00:00Z', updated_at: '2026-02-20T00:00:00Z' },
  { id: 6, name: 'Laura Jiménez',   phone: '555-2345', email: 'laura@email.com', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
]

// ---- VEHICLES ----
export const mockVehicles: Vehicle[] = [
  { id: 1, type: 'automovil',      brand: 'Toyota',    model: 'Corolla 2020',    plate: 'ABC-123', color: 'Blanco',  client_id: 1, created_at: '2026-01-10T00:00:00Z' },
  { id: 2, type: 'camion_estandar',brand: 'Ford',      model: 'F-150 2019',      plate: 'XYZ-789', color: 'Negro',   client_id: 2, created_at: '2026-01-15T00:00:00Z' },
  { id: 3, type: 'automovil',      brand: 'Honda',     model: 'Civic 2021',      plate: 'DEF-456', color: 'Azul',    client_id: 3, created_at: '2026-02-01T00:00:00Z' },
  { id: 4, type: 'automovil',      brand: 'Mazda',     model: 'CX-5 2022',       plate: 'GHI-321', color: 'Rojo',    client_id: 4, created_at: '2026-02-10T00:00:00Z' },
  { id: 5, type: 'camion_xl',      brand: 'Chevrolet', model: 'Silverado 2020',  plate: 'JKL-654', color: 'Plata',   client_id: 5, created_at: '2026-02-20T00:00:00Z' },
  { id: 6, type: 'automovil',      brand: 'BMW',       model: '3 Series 2023',   plate: 'MNO-987', color: 'Blanco',  client_id: 6, created_at: '2026-03-01T00:00:00Z' },
  { id: 7, type: 'camion_estandar',brand: 'Toyota',    model: 'Hilux 2021',      plate: 'PQR-147', color: 'Gris',    created_at: '2026-03-05T00:00:00Z' },
  { id: 8, type: 'automovil',      brand: 'Hyundai',   model: 'Tucson 2022',     plate: 'STU-258', color: 'Verde',   client_id: 1, created_at: '2026-03-10T00:00:00Z' },
]

// ---- OPERATORS ----
export const mockOperators: Operator[] = [
  { id: 1, name: 'Carlos Mora',      phone: '555-0001', commission_rate: 30, active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'Francisco Currea', phone: '555-0002', commission_rate: 30, active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 3, name: 'Luis López',       phone: '555-0003', commission_rate: 30, active: true, created_at: '2026-01-01T00:00:00Z' },
]

// ---- SERVICES ----
const D = '2026-01-01T00:00:00Z'
export const mockServices: Service[] = [
  // Exterior / Servicios Básicos
  { id: 1,  category: 'exterior',           name: 'Premium Wash',                  price_automovil: 51000,   price_camion_estandar: 60000,   price_camion_xl: 66000,   active: true, created_at: D, updated_at: D },
  { id: 2,  category: 'exterior',           name: 'Premium Wash Hidrofobic',        price_automovil: 85000,   price_camion_estandar: 95000,   price_camion_xl: 110000,  active: true, created_at: D, updated_at: D },
  { id: 3,  category: 'exterior',           name: 'Detallado de Llantas',           price_automovil: 165000,  price_camion_estandar: 195000,  price_camion_xl: 195000,  active: true, created_at: D, updated_at: D },
  { id: 4,  category: 'exterior',           name: 'Chasis + Premium Wash',          price_automovil: 94000,   price_camion_estandar: 105000,  price_camion_xl: 115000,  active: true, created_at: D, updated_at: D },
  { id: 5,  category: 'exterior',           name: 'Motor Detailing + Vapor',        price_automovil: 220000,  price_camion_estandar: 245000,  price_camion_xl: 270000,  active: true, created_at: D, updated_at: D },
  { id: 6,  category: 'exterior',           name: 'Motor + Premium Wash',           price_automovil: 130000,  price_camion_estandar: 150000,  price_camion_xl: 170000,  active: true, created_at: D, updated_at: D },
  { id: 7,  category: 'exterior',           name: 'Premium Wash + Chasis + Motor',  price_automovil: 145000,  price_camion_estandar: 170000,  price_camion_xl: 190000,  active: true, created_at: D, updated_at: D },
  { id: 8,  category: 'exterior',           name: 'Hidrophobic + Chasis',           price_automovil: 130000,  price_camion_estandar: 145000,  price_camion_xl: 160000,  active: true, created_at: D, updated_at: D },
  { id: 9,  category: 'exterior',           name: 'Wax Service',                    price_automovil: 125000,  price_camion_estandar: 145000,  price_camion_xl: 160000,  active: true, created_at: D, updated_at: D },
  { id: 10, category: 'exterior',           name: 'Wash and Protect',               price_automovil: 180000,  price_camion_estandar: 205000,  price_camion_xl: 225000,  active: true, created_at: D, updated_at: D },
  { id: 11, category: 'exterior',           name: 'Descontamination Service',       price_automovil: 215000,  price_camion_estandar: 226000,  price_camion_xl: 300000,  active: true, created_at: D, updated_at: D },
  // Interior
  { id: 12, category: 'interior',           name: 'Estrene Otra Vez',               price_automovil: 395000,  price_camion_estandar: 460000,  price_camion_xl: 560000,  active: true, created_at: D, updated_at: D },
  { id: 13, category: 'interior',           name: 'Carpet Renew',                   price_automovil: 300000,  price_camion_estandar: 320000,  price_camion_xl: 360000,  active: true, created_at: D, updated_at: D },
  { id: 14, category: 'interior',           name: 'Combo, Asientos y Carteras',     price_automovil: 290000,  price_camion_estandar: 320000,  price_camion_xl: 390000,  active: true, created_at: D, updated_at: D },
  { id: 15, category: 'interior',           name: 'Limpieza Asientos',              price_automovil: 175000,  price_camion_estandar: 185000,  price_camion_xl: 195000,  active: true, created_at: D, updated_at: D },
  { id: 16, category: 'interior',           name: 'Limpieza de Techo',              price_automovil: 220000,  price_camion_estandar: 245000,  price_camion_xl: 270000,  active: true, created_at: D, updated_at: D },
  { id: 17, category: 'interior',           name: 'Limpieza Interior Básica',       price_automovil: 170000,  price_camion_estandar: 200000,  price_camion_xl: 230000,  active: true, created_at: D, updated_at: D },
  { id: 18, category: 'interior',           name: 'Limpieza Tapete',                price_automovil: 170000,  price_camion_estandar: 210000,  price_camion_xl: 260000,  active: true, created_at: D, updated_at: D },
  { id: 19, category: 'interior',           name: 'Hidratación Cuero',              price_automovil: 85000,   price_camion_estandar: 85000,   price_camion_xl: 105000,  active: true, created_at: D, updated_at: D },
  { id: 20, category: 'interior',           name: 'Interior Protection',            price_automovil: 870000,  price_camion_estandar: 1000000, price_camion_xl: 1150000, active: true, created_at: D, updated_at: D },
  // Corrección de Pintura
  { id: 21, category: 'correccion_pintura', name: 'Rejuvenecimiento de Pintura',    price_automovil: 335000,  price_camion_estandar: 390000,  price_camion_xl: 430000,  active: true, created_at: D, updated_at: D },
  { id: 22, category: 'correccion_pintura', name: 'Exterior Detailing Service',     price_automovil: 490000,  price_camion_estandar: 600000,  price_camion_xl: 650000,  active: true, created_at: D, updated_at: D },
  { id: 23, category: 'correccion_pintura', name: 'Restoration to Shine',           price_automovil: 680000,  price_camion_estandar: 810000,  price_camion_xl: 940000,  active: true, created_at: D, updated_at: D },
  { id: 24, category: 'correccion_pintura', name: 'Signature',                      price_automovil: 800000,  price_camion_estandar: 920000,  price_camion_xl: 1150000, active: true, created_at: D, updated_at: D },
  // Protección Cerámica
  { id: 25, category: 'ceramico',           name: 'Superior Shine +9 EXCLUSIVE',    price_automovil: 3400000, price_camion_estandar: 3950000, price_camion_xl: 4500000, active: true, created_at: D, updated_at: D },
  { id: 26, category: 'ceramico',           name: 'Superior Shine +9',              price_automovil: 2780000, price_camion_estandar: 2980000, price_camion_xl: 3380000, active: true, created_at: D, updated_at: D },
  { id: 27, category: 'ceramico',           name: 'Superior Shine +5',              price_automovil: 2050000, price_camion_estandar: 2300000, price_camion_xl: 2500000, active: true, created_at: D, updated_at: D },
  { id: 28, category: 'ceramico',           name: 'Superior Shine +2',              price_automovil: 980000,  price_camion_estandar: 1300000, price_camion_xl: 1450000, active: true, created_at: D, updated_at: D },
]

// ---- SERVICE ORDERS ----
export const mockOrders: ServiceOrder[] = [
  { id: 1,  order_number: 'ORD-2026-0001', date: '2026-03-10', vehicle_id: 1, operator_id: 1, status: 'entregado', subtotal: 80,  discount: 0, total: 80,  paid: true,  payment_method: 'efectivo',      created_at: '2026-03-10T09:00:00Z', updated_at: '2026-03-10T12:00:00Z' },
  { id: 2,  order_number: 'ORD-2026-0002', date: '2026-03-11', vehicle_id: 2, operator_id: 2, status: 'entregado', subtotal: 90,  discount: 0, total: 90,  paid: true,  payment_method: 'transferencia',  created_at: '2026-03-11T10:00:00Z', updated_at: '2026-03-11T14:00:00Z' },
  { id: 3,  order_number: 'ORD-2026-0003', date: '2026-03-12', vehicle_id: 3, operator_id: 1, status: 'entregado', subtotal: 150, discount: 0, total: 150, paid: true,  payment_method: 'efectivo',      created_at: '2026-03-12T08:30:00Z', updated_at: '2026-03-12T13:00:00Z' },
  { id: 4,  order_number: 'ORD-2026-0004', date: '2026-03-13', vehicle_id: 4, operator_id: 3, status: 'entregado', subtotal: 300, discount: 0, total: 300, paid: true,  payment_method: 'tarjeta',       created_at: '2026-03-13T09:00:00Z', updated_at: '2026-03-13T15:00:00Z' },
  { id: 5,  order_number: 'ORD-2026-0005', date: '2026-03-14', vehicle_id: 5, operator_id: 2, status: 'entregado', subtotal: 130, discount: 0, total: 130, paid: true,  payment_method: 'efectivo',      created_at: '2026-03-14T09:00:00Z', updated_at: '2026-03-14T14:00:00Z' },
  { id: 6,  order_number: 'ORD-2026-0006', date: '2026-03-17', vehicle_id: 6, operator_id: 1, status: 'listo',    subtotal: 500, discount: 0, total: 500, paid: false, created_at: '2026-03-17T09:00:00Z', updated_at: '2026-03-17T11:00:00Z' },
  { id: 7,  order_number: 'ORD-2026-0007', date: '2026-03-18', vehicle_id: 7, operator_id: 3, status: 'en_proceso',subtotal: 120, discount: 0, total: 120, paid: false, created_at: '2026-03-18T08:00:00Z', updated_at: '2026-03-18T08:30:00Z' },
  { id: 8,  order_number: 'ORD-2026-0008', date: '2026-03-18', vehicle_id: 8, operator_id: 2, status: 'en_proceso',subtotal: 55,  discount: 0, total: 55,  paid: false, created_at: '2026-03-18T09:30:00Z', updated_at: '2026-03-18T09:45:00Z' },
  { id: 9,  order_number: 'ORD-2026-0009', date: '2026-03-18', vehicle_id: 1, operator_id: 1, status: 'pendiente', subtotal: 80,  discount: 0, total: 80,  paid: false, created_at: '2026-03-18T10:00:00Z', updated_at: '2026-03-18T10:00:00Z' },
  { id: 10, order_number: 'ORD-2026-0010', date: '2026-03-18', vehicle_id: 4, operator_id: 3, status: 'pendiente', subtotal: 30,  discount: 0, total: 30,  paid: false, created_at: '2026-03-18T10:30:00Z', updated_at: '2026-03-18T10:30:00Z' },
]

// ---- ORDER ITEMS ----
export const mockOrderItems: ServiceOrderItem[] = [
  { id: 1,  order_id: 1,  service_id: 2,  service_name: 'Lavado Premium',              service_category: 'exterior', unit_price: 30,  quantity: 1, subtotal: 30 },
  { id: 2,  order_id: 1,  service_id: 4,  service_name: 'Encerado',                    service_category: 'exterior', unit_price: 50,  quantity: 1, subtotal: 50 },
  { id: 3,  order_id: 2,  service_id: 2,  service_name: 'Lavado Premium',              service_category: 'exterior', unit_price: 40,  quantity: 1, subtotal: 40 },
  { id: 4,  order_id: 2,  service_id: 5,  service_name: 'Limpieza Interior Básica',    service_category: 'interior', unit_price: 35,  quantity: 1, subtotal: 35 },
  { id: 5,  order_id: 2,  service_id: 1,  service_name: 'Lavado Básico',               service_category: 'exterior', unit_price: 20,  quantity: 1, subtotal: 20 },
  { id: 6,  order_id: 3,  service_id: 7,  service_name: 'Shampoo Tapicería',           service_category: 'interior', unit_price: 60,  quantity: 1, subtotal: 60 },
  { id: 7,  order_id: 3,  service_id: 3,  service_name: 'Pulido',                      service_category: 'exterior', unit_price: 80,  quantity: 1, subtotal: 80 },
  { id: 8,  order_id: 4,  service_id: 8,  service_name: 'Tratamiento Cerámico Básico', service_category: 'ceramico', unit_price: 200, quantity: 1, subtotal: 200 },
  { id: 9,  order_id: 4,  service_id: 6,  service_name: 'Limpieza Interior Profunda',  service_category: 'interior', unit_price: 40,  quantity: 1, subtotal: 40 },
  { id: 10, order_id: 4,  service_id: 1,  service_name: 'Lavado Básico',               service_category: 'exterior', unit_price: 15,  quantity: 1, subtotal: 15 },
  { id: 11, order_id: 5,  service_id: 2,  service_name: 'Lavado Premium',              service_category: 'exterior', unit_price: 50,  quantity: 1, subtotal: 50 },
  { id: 12, order_id: 5,  service_id: 7,  service_name: 'Shampoo Tapicería',           service_category: 'interior', unit_price: 80,  quantity: 1, subtotal: 80 },
  { id: 13, order_id: 6,  service_id: 10, service_name: 'Tratamiento Cerámico Elite',  service_category: 'ceramico', unit_price: 500, quantity: 1, subtotal: 500 },
  { id: 14, order_id: 7,  service_id: 2,  service_name: 'Lavado Premium',              service_category: 'exterior', unit_price: 40,  quantity: 1, subtotal: 40 },
  { id: 15, order_id: 7,  service_id: 6,  service_name: 'Limpieza Interior Profunda',  service_category: 'interior', unit_price: 55,  quantity: 1, subtotal: 55 },
  { id: 16, order_id: 8,  service_id: 6,  service_name: 'Limpieza Interior Profunda',  service_category: 'interior', unit_price: 40,  quantity: 1, subtotal: 40 },
  { id: 17, order_id: 8,  service_id: 1,  service_name: 'Lavado Básico',               service_category: 'exterior', unit_price: 15,  quantity: 1, subtotal: 15 },
  { id: 18, order_id: 9,  service_id: 2,  service_name: 'Lavado Premium',              service_category: 'exterior', unit_price: 30,  quantity: 1, subtotal: 30 },
  { id: 19, order_id: 9,  service_id: 4,  service_name: 'Encerado',                    service_category: 'exterior', unit_price: 50,  quantity: 1, subtotal: 50 },
  { id: 20, order_id: 10, service_id: 2,  service_name: 'Lavado Premium',              service_category: 'exterior', unit_price: 30,  quantity: 1, subtotal: 30 },
]

// ---- APPOINTMENTS ----
export const mockAppointments: Appointment[] = [
  { id: 1,  date: '2026-03-16', time: '09:00', vehicle_type: 'automovil',       brand: 'Toyota',    model: 'Corolla 2020', plate: 'ABC-123', client_id: 1, client_name: 'Juan Pérez',      client_phone: '555-1234', comments: 'Prefiere la mañana',       status: 'completada', order_id: 1, created_at: '2026-03-14T00:00:00Z', updated_at: '2026-03-16T00:00:00Z' },
  { id: 2,  date: '2026-03-17', time: '10:00', vehicle_type: 'camion_estandar', brand: 'Ford',      model: 'F-150 2019',   plate: 'XYZ-789', client_id: 2, client_name: 'María González',  client_phone: '555-5678', comments: '',                         status: 'completada', order_id: 2, created_at: '2026-03-14T00:00:00Z', updated_at: '2026-03-17T00:00:00Z' },
  { id: 3,  date: '2026-03-18', time: '08:30', vehicle_type: 'automovil',       brand: 'Honda',     model: 'Civic 2021',   plate: 'DEF-456', client_id: 3, client_name: 'Carlos Rodríguez',client_phone: '555-9012', comments: 'Cliente frecuente',        status: 'confirmada', created_at: '2026-03-15T00:00:00Z', updated_at: '2026-03-17T00:00:00Z' },
  { id: 4,  date: '2026-03-18', time: '11:00', vehicle_type: 'automovil',       brand: 'BMW',       model: '3 Series 2023',plate: 'MNO-987', client_id: 6, client_name: 'Laura Jiménez',   client_phone: '555-2345', comments: 'Tratamiento cerámico',     status: 'programada', created_at: '2026-03-16T00:00:00Z', updated_at: '2026-03-16T00:00:00Z' },
  { id: 5,  date: '2026-03-19', time: '09:00', vehicle_type: 'automovil',       brand: 'Mazda',     model: 'CX-5 2022',    plate: 'GHI-321', client_id: 4, client_name: 'Ana Martínez',    client_phone: '555-3456', comments: '',                         status: 'programada', created_at: '2026-03-16T00:00:00Z', updated_at: '2026-03-16T00:00:00Z' },
  { id: 6,  date: '2026-03-19', time: '14:00', vehicle_type: 'camion_xl',       brand: 'Chevrolet', model: 'Silverado',    plate: 'JKL-654', client_id: 5, client_name: 'Roberto Silva',   client_phone: '555-7890', comments: 'Lavado completo',          status: 'programada', created_at: '2026-03-17T00:00:00Z', updated_at: '2026-03-17T00:00:00Z' },
  { id: 7,  date: '2026-03-20', time: '10:00', vehicle_type: 'automovil',       brand: 'Nissan',    model: 'Sentra 2020',  plate: 'VWX-369', client_name: 'Pedro Ramírez',                  client_phone: '555-4567', comments: 'Primera vez',              status: 'programada', created_at: '2026-03-17T00:00:00Z', updated_at: '2026-03-17T00:00:00Z' },
  { id: 8,  date: '2026-03-20', time: '15:00', vehicle_type: 'automovil',       brand: 'Volkswagen',model: 'Jetta 2021',   plate: 'YZA-741', client_name: 'Sofía Morales',                  client_phone: '555-8901', comments: '',                         status: 'programada', created_at: '2026-03-17T00:00:00Z', updated_at: '2026-03-17T00:00:00Z' },
  { id: 9,  date: '2026-03-21', time: '09:00', vehicle_type: 'automovil',       brand: 'Kia',       model: 'Sportage 2022',plate: 'BCD-852', client_name: 'Diego Castro',                   client_phone: '555-2356', comments: 'Pulido y encerado',        status: 'programada', created_at: '2026-03-18T00:00:00Z', updated_at: '2026-03-18T00:00:00Z' },
  { id: 10, date: '2026-03-21', time: '11:30', vehicle_type: 'camion_estandar', brand: 'Toyota',    model: 'Hilux 2021',   plate: 'EFG-963', client_name: 'Marina López',                   client_phone: '555-6789', comments: '',                         status: 'programada', created_at: '2026-03-18T00:00:00Z', updated_at: '2026-03-18T00:00:00Z' },
]

export const mockAppointmentServices: AppointmentService[] = [
  { id: 1, appointment_id: 3,  service_name: 'Lavado Premium' },
  { id: 2, appointment_id: 3,  service_name: 'Encerado' },
  { id: 3, appointment_id: 4,  service_name: 'Tratamiento Cerámico Elite' },
  { id: 4, appointment_id: 5,  service_name: 'Pulido' },
  { id: 5, appointment_id: 5,  service_name: 'Lavado Premium' },
  { id: 6, appointment_id: 6,  service_name: 'Shampoo Tapicería' },
  { id: 7, appointment_id: 7,  service_name: 'Lavado Básico' },
  { id: 8, appointment_id: 8,  service_name: 'Limpieza Interior Profunda' },
  { id: 9, appointment_id: 9,  service_name: 'Pulido' },
  { id: 10,appointment_id: 9,  service_name: 'Encerado' },
]

// ---- PATIO ENTRIES ----
export const mockPatioEntries: PatioEntry[] = [
  { id: 1, order_id: 9,  vehicle_id: 1, position: 1, status: 'esperando',  entered_at: '2026-03-18T10:00:00Z' },
  { id: 2, order_id: 10, vehicle_id: 4, position: 2, status: 'esperando',  entered_at: '2026-03-18T10:30:00Z' },
  { id: 3, order_id: 7,  vehicle_id: 7, position: 3, status: 'en_proceso', entered_at: '2026-03-18T08:00:00Z', started_at: '2026-03-18T08:30:00Z' },
  { id: 4, order_id: 8,  vehicle_id: 8, position: 4, status: 'en_proceso', entered_at: '2026-03-18T09:30:00Z', started_at: '2026-03-18T09:45:00Z' },
  { id: 5, order_id: 6,  vehicle_id: 6, position: 5, status: 'listo',      entered_at: '2026-03-17T09:00:00Z', started_at: '2026-03-17T09:20:00Z', completed_at: '2026-03-17T11:00:00Z' },
  { id: 6, order_id: 3,  vehicle_id: 3, position: 6, status: 'listo',      entered_at: '2026-03-18T07:00:00Z', started_at: '2026-03-18T07:30:00Z', completed_at: '2026-03-18T09:00:00Z' },
  { id: 7, order_id: 1,  vehicle_id: 1, position: 7, status: 'entregado',  entered_at: '2026-03-10T09:00:00Z', started_at: '2026-03-10T09:15:00Z', completed_at: '2026-03-10T11:30:00Z', delivered_at: '2026-03-10T12:00:00Z' },
  { id: 8, order_id: 2,  vehicle_id: 2, position: 8, status: 'entregado',  entered_at: '2026-03-11T10:00:00Z', started_at: '2026-03-11T10:30:00Z', completed_at: '2026-03-11T13:00:00Z', delivered_at: '2026-03-11T14:00:00Z' },
]

// ---- INVENTORY CATEGORIES ----
export const mockInventoryCategories: InventoryCategory[] = [
  { id: 1, name: 'Productos de Limpieza' },
  { id: 2, name: 'Ceras y Pulimentos' },
  { id: 3, name: 'Productos Cerámicos' },
  { id: 4, name: 'Materiales y Herramientas' },
]

// ---- INVENTORY ITEMS ----
export const mockInventoryItems: InventoryItem[] = [
  { id: 1, category_id: 1, name: 'Shampoo para autos',   description: 'pH neutro, alta espuma',  quantity: 2.5,  unit: 'litros',   min_stock: 3,  cost_per_unit: 8.50,  updated_at: '2026-03-15T00:00:00Z' },
  { id: 2, category_id: 1, name: 'Desengrasante',        description: 'Uso profesional',         quantity: 5.0,  unit: 'litros',   min_stock: 2,  cost_per_unit: 6.00,  updated_at: '2026-03-14T00:00:00Z' },
  { id: 3, category_id: 1, name: 'Ambientador',          description: 'Aroma cítrico',           quantity: 20,   unit: 'unidades', min_stock: 5,  cost_per_unit: 2.50,  updated_at: '2026-03-12T00:00:00Z' },
  { id: 4, category_id: 2, name: 'Cera de carnauba',     description: 'Acabado espejo',          quantity: 0.8,  unit: 'kg',       min_stock: 1,  cost_per_unit: 25.00, updated_at: '2026-03-10T00:00:00Z' },
  { id: 5, category_id: 2, name: 'Pulidor compuesto',    description: 'Corte medio',             quantity: 3.0,  unit: 'litros',   min_stock: 1,  cost_per_unit: 30.00, updated_at: '2026-03-13T00:00:00Z' },
  { id: 6, category_id: 3, name: 'Kit cerámico básico',  description: 'Protección 12 meses',     quantity: 1,    unit: 'unidades', min_stock: 2,  cost_per_unit: 80.00, updated_at: '2026-03-16T00:00:00Z' },
  { id: 7, category_id: 4, name: 'Microfibra 40x40',     description: '350 GSM',                 quantity: 28,   unit: 'unidades', min_stock: 10, cost_per_unit: 1.50,  updated_at: '2026-03-11T00:00:00Z' },
  { id: 8, category_id: 4, name: 'Esponja aplicación',   description: 'Para ceras y cerámicos',  quantity: 4,    unit: 'unidades', min_stock: 5,  cost_per_unit: 1.00,  updated_at: '2026-03-17T00:00:00Z' },
]

// ---- CERAMIC TREATMENTS ----
export const mockCeramics: CeramicTreatment[] = [
  { id: 1, order_id: 4,  vehicle_id: 4, treatment_type: 'Superior Shine +2',           operator_id: 3, application_date: '2025-12-01', warranty_months: 6, warranty_expiry: '2026-06-01', notes: '', created_at: '2025-12-01T00:00:00Z' },
  { id: 2, order_id: 3,  vehicle_id: 3, treatment_type: 'Superior Shine +5',           operator_id: 1, application_date: '2025-10-15', warranty_months: 6, warranty_expiry: '2026-04-15', notes: '', created_at: '2025-10-15T00:00:00Z' },
  { id: 3, order_id: 2,  vehicle_id: 2, treatment_type: 'Superior Shine +2',           operator_id: 2, application_date: '2025-08-20', warranty_months: 6, warranty_expiry: '2026-02-20', notes: '', created_at: '2025-08-20T00:00:00Z' },
  { id: 4, order_id: 6,  vehicle_id: 6, treatment_type: 'Superior Shine +9 EXCLUSIVE', operator_id: 1, application_date: '2026-03-17', warranty_months: 6, warranty_expiry: '2026-09-17', notes: '', created_at: '2026-03-17T00:00:00Z' },
  { id: 5, order_id: 1,  vehicle_id: 1, treatment_type: 'Superior Shine +9',           operator_id: 1, application_date: '2026-03-01', warranty_months: 6, warranty_expiry: '2026-09-01', notes: '', created_at: '2026-03-01T00:00:00Z' },
]

// ---- LIQUIDATIONS ----
export const mockLiquidations: Liquidation[] = [
  { id: 1, operator_id: 1, period_start: '2026-03-01', period_end: '2026-03-15', total_services: 4, total_amount: 310, commission_rate: 30, commission_amount: 93,  status: 'pendiente', created_at: '2026-03-15T00:00:00Z' },
  { id: 2, operator_id: 2, period_start: '2026-03-01', period_end: '2026-03-15', total_services: 5, total_amount: 465, commission_rate: 30, commission_amount: 139.5,status: 'pendiente', created_at: '2026-03-15T00:00:00Z' },
  { id: 3, operator_id: 1, period_start: '2026-02-01', period_end: '2026-02-28', total_services: 6, total_amount: 480, commission_rate: 30, commission_amount: 144, status: 'pagada',    paid_at: '2026-03-05T00:00:00Z', created_at: '2026-02-28T00:00:00Z' },
  { id: 4, operator_id: 3, period_start: '2026-03-01', period_end: '2026-03-15', total_services: 3, total_amount: 195, commission_rate: 30, commission_amount: 58.5, status: 'pendiente', created_at: '2026-03-15T00:00:00Z' },
]

export const mockLiquidationOrders: LiquidationOrder[] = [
  { id: 1,  liquidation_id: 1, order_id: 1, order_total: 80  },
  { id: 2,  liquidation_id: 1, order_id: 3, order_total: 150 },
  { id: 3,  liquidation_id: 2, order_id: 2, order_total: 90  },
  { id: 4,  liquidation_id: 2, order_id: 5, order_total: 130 },
  { id: 5,  liquidation_id: 4, order_id: 4, order_total: 300 },
]

// ---- TRANSACTIONS ----
export const mockTransactions: Transaction[] = [
  { id: 1,  date: '2026-03-10', type: 'ingreso', category: 'Servicios',  description: 'ORD-2026-0001 - Toyota Corolla',    amount: 80,   order_id: 1,  created_at: '2026-03-10T12:00:00Z' },
  { id: 2,  date: '2026-03-11', type: 'ingreso', category: 'Servicios',  description: 'ORD-2026-0002 - Ford F-150',         amount: 90,   order_id: 2,  created_at: '2026-03-11T14:00:00Z' },
  { id: 3,  date: '2026-03-12', type: 'ingreso', category: 'Servicios',  description: 'ORD-2026-0003 - Honda Civic',        amount: 150,  order_id: 3,  created_at: '2026-03-12T13:00:00Z' },
  { id: 4,  date: '2026-03-13', type: 'ingreso', category: 'Servicios',  description: 'ORD-2026-0004 - Mazda CX-5',         amount: 300,  order_id: 4,  created_at: '2026-03-13T15:00:00Z' },
  { id: 5,  date: '2026-03-14', type: 'ingreso', category: 'Servicios',  description: 'ORD-2026-0005 - Chevrolet Silverado',amount: 130,  order_id: 5,  created_at: '2026-03-14T14:00:00Z' },
  { id: 6,  date: '2026-03-10', type: 'egreso',  category: 'Insumos',    description: 'Compra shampoo y desengrasante',     amount: 85,   created_at: '2026-03-10T08:00:00Z' },
  { id: 7,  date: '2026-03-12', type: 'egreso',  category: 'Insumos',    description: 'Kit cerámico básico x2',             amount: 160,  created_at: '2026-03-12T08:00:00Z' },
  { id: 8,  date: '2026-03-13', type: 'egreso',  category: 'Servicios',  description: 'Reparación compresor',               amount: 200,  created_at: '2026-03-13T16:00:00Z' },
  { id: 9,  date: '2026-03-15', type: 'egreso',  category: 'Salarios',   description: 'Anticipo operarios',                 amount: 300,  created_at: '2026-03-15T10:00:00Z' },
  { id: 10, date: '2026-03-15', type: 'ingreso', category: 'Otros',      description: 'Venta insumos sobrantes',            amount: 45,   created_at: '2026-03-15T11:00:00Z' },
  { id: 11, date: '2026-03-03', type: 'ingreso', category: 'Servicios',  description: 'Servicios semana 1',                 amount: 420,  created_at: '2026-03-03T18:00:00Z' },
  { id: 12, date: '2026-03-03', type: 'egreso',  category: 'Insumos',    description: 'Reposición stock semanal',           amount: 95,   created_at: '2026-03-03T08:00:00Z' },
  { id: 13, date: '2026-02-28', type: 'ingreso', category: 'Servicios',  description: 'Cierre febrero',                    amount: 1850, created_at: '2026-02-28T18:00:00Z' },
  { id: 14, date: '2026-02-28', type: 'egreso',  category: 'Salarios',   description: 'Nómina febrero',                    amount: 900,  created_at: '2026-02-28T17:00:00Z' },
  { id: 15, date: '2026-02-28', type: 'egreso',  category: 'Servicios',  description: 'Agua y electricidad',               amount: 180,  created_at: '2026-02-28T16:00:00Z' },
  { id: 16, date: '2026-02-15', type: 'ingreso', category: 'Servicios',  description: 'Servicios quincena 1 febrero',      amount: 960,  created_at: '2026-02-15T18:00:00Z' },
  { id: 17, date: '2026-02-15', type: 'egreso',  category: 'Insumos',    description: 'Compra ceras y pulimentos',         amount: 220,  created_at: '2026-02-15T08:00:00Z' },
  { id: 18, date: '2026-03-17', type: 'egreso',  category: 'Insumos',    description: 'Microfibras x20',                   amount: 30,   created_at: '2026-03-17T08:00:00Z' },
  { id: 19, date: '2026-03-16', type: 'ingreso', category: 'Servicios',  description: 'Servicios lunes',                   amount: 235,  created_at: '2026-03-16T18:00:00Z' },
  { id: 20, date: '2026-03-16', type: 'egreso',  category: 'Otros',      description: 'Publicidad redes sociales',         amount: 50,   created_at: '2026-03-16T12:00:00Z' },
]

// ---- DOCUMENTS ----
export const mockDocuments: Document[] = [
  { id: 1, name: 'Contrato servicio cerámico - BMW',      type: 'contrato', file_path: '/docs/contrato-001.pdf', file_size: 245000, mime_type: 'application/pdf',  related_to: 'order',   related_id: 6, notes: 'Firmado por cliente', uploaded_at: '2026-03-17T10:00:00Z' },
  { id: 2, name: 'Factura insumos marzo',                  type: 'factura',  file_path: '/docs/factura-001.pdf',  file_size: 180000, mime_type: 'application/pdf',  related_to: 'general',              notes: '',                   uploaded_at: '2026-03-10T09:00:00Z' },
  { id: 3, name: 'Recibo pago Toyota Corolla',             type: 'recibo',   file_path: '/docs/recibo-001.pdf',   file_size: 95000,  mime_type: 'application/pdf',  related_to: 'order',   related_id: 1, notes: '',                   uploaded_at: '2026-03-10T12:30:00Z' },
  { id: 4, name: 'Foto estado vehículo - Ford F-150',      type: 'otro',     file_path: '/docs/foto-001.jpg',     file_size: 2100000,mime_type: 'image/jpeg',       related_to: 'vehicle', related_id: 2, notes: 'Pre-servicio',       uploaded_at: '2026-03-11T10:00:00Z' },
  { id: 5, name: 'Contrato lavado mensual - Juan Pérez',   type: 'contrato', file_path: '/docs/contrato-002.pdf', file_size: 310000, mime_type: 'application/pdf',  related_to: 'client',  related_id: 1, notes: 'Vigente hasta junio', uploaded_at: '2026-03-01T09:00:00Z' },
  { id: 6, name: 'Listado precios 2026',                   type: 'otro',     file_path: '/docs/precios-2026.xlsx',file_size: 45000,  mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', related_to: 'general', notes: 'Aprobado gerencia', uploaded_at: '2026-01-02T09:00:00Z' },
  { id: 7, name: 'Recibo pago Ford F-150',                 type: 'recibo',   file_path: '/docs/recibo-002.pdf',   file_size: 91000,  mime_type: 'application/pdf',  related_to: 'order',   related_id: 2, notes: '',                   uploaded_at: '2026-03-11T14:30:00Z' },
  { id: 8, name: 'Certificado garantía cerámico - Mazda',  type: 'otro',     file_path: '/docs/garantia-001.pdf', file_size: 155000, mime_type: 'application/pdf',  related_to: 'vehicle', related_id: 4, notes: 'Garantía 6 meses',   uploaded_at: '2026-03-13T16:00:00Z' },
]

// ---- HELPER FUNCTIONS ----
export const getVehicleById    = (id: number) => mockVehicles.find(v => v.id === id)
export const getClientById     = (id: number) => mockClients.find(c => c.id === id)
export const getOperatorById   = (id: number) => mockOperators.find(o => o.id === id)
export const getOrderById      = (id: number) => mockOrders.find(o => o.id === id)
export const getItemsByOrderId = (orderId: number) => mockOrderItems.filter(i => i.order_id === orderId)
export const getServicePrice   = (service: Service, type: Vehicle['type']): number => {
  if (type === 'camion_estandar') return service.price_camion_estandar ?? service.price_automovil
  if (type === 'camion_xl')       return service.price_camion_xl ?? service.price_automovil
  return service.price_automovil
}
export const getInventoryCategoryName = (id?: number) =>
  mockInventoryCategories.find(c => c.id === id)?.name ?? '—'
export const getLiquidationOrdersByLiquidationId = (lid: number) =>
  mockLiquidationOrders.filter(lo => lo.liquidation_id === lid)
export const getAppointmentServicesByAppointmentId = (aid: number) =>
  mockAppointmentServices.filter(s => s.appointment_id === aid)
