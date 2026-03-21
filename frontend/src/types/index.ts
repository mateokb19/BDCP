// ---- Enums as string literals (mirror DB enum types) ----
export type VehicleType       = 'automovil' | 'camion_estandar' | 'camion_xl'
export type ServiceCategory   = 'exterior' | 'interior' | 'ceramico' | 'correccion_pintura'
export type OrderStatus       = 'pendiente' | 'en_proceso' | 'listo' | 'entregado' | 'cancelado'
export type PatioStatus       = 'esperando' | 'en_proceso' | 'listo' | 'entregado'
export type AppointmentStatus = 'programada' | 'confirmada' | 'completada' | 'cancelada' | 'no_asistio'
export type TransactionType   = 'ingreso' | 'egreso'
export type LiquidationStatus = 'pendiente' | 'pagada'
export type UserRole          = 'admin' | 'recepcion' | 'operario'
export type MovementType      = 'entrada' | 'salida'

// ---- Entity Interfaces ----

export interface Client {
  id: number
  name: string
  phone?: string
  email?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: number
  type: VehicleType
  brand?: string
  model?: string
  plate: string
  color?: string
  client_id?: number
  created_at: string
}

export interface Operator {
  id: number
  name: string
  phone?: string
  cedula?: string
  commission_rate: number
  active: boolean
  created_at?: string
}

export interface Service {
  id: number
  category: ServiceCategory
  name: string
  description?: string
  price_automovil: number
  price_camion_estandar?: number
  price_camion_xl?: number
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface ServiceOrder {
  id: number
  order_number: string
  date: string
  vehicle_id: number
  operator_id?: number
  status: OrderStatus
  subtotal: number
  discount: number
  total: number
  paid: boolean
  payment_method?: string
  notes?: string
  appointment_id?: number
  created_at: string
  updated_at: string
}

export interface ServiceOrderItem {
  id: number
  order_id: number
  service_id?: number
  service_name: string
  service_category: ServiceCategory
  unit_price: number
  quantity: number
  subtotal: number
}

export interface Appointment {
  id: number
  date: string
  time?: string
  vehicle_type?: VehicleType
  brand?: string
  model?: string
  plate?: string
  client_id?: number
  client_name?: string
  client_phone?: string
  comments?: string
  status: AppointmentStatus
  order_id?: number
  created_at: string
  updated_at: string
}

export interface AppointmentService {
  id: number
  appointment_id: number
  service_id?: number
  service_name: string
}

export interface PatioEntry {
  id: number
  order_id: number
  vehicle_id: number
  position?: number
  status: PatioStatus
  entered_at: string
  started_at?: string
  completed_at?: string
  delivered_at?: string
  notes?: string
}

export interface InventoryCategory {
  id: number
  name: string
}

export interface InventoryItem {
  id: number
  category_id?: number
  name: string
  description?: string
  quantity: number
  unit: string
  min_stock: number
  cost_per_unit?: number
  updated_at: string
}

export interface InventoryMovement {
  id: number
  item_id: number
  type: MovementType
  quantity: number
  reason?: string
  order_id?: number
  created_at: string
}

export interface CeramicTreatment {
  id: number
  order_id: number
  vehicle_id: number
  treatment_type: string
  operator_id?: number
  application_date: string
  warranty_months: number
  warranty_expiry?: string
  notes?: string
  created_at: string
}

export interface Liquidation {
  id: number
  operator_id: number
  period_start: string
  period_end: string
  total_services: number
  total_amount: number
  commission_rate: number
  commission_amount: number
  status: LiquidationStatus
  paid_at?: string
  notes?: string
  created_at: string
}

export interface LiquidationOrder {
  id: number
  liquidation_id: number
  order_id: number
  order_total: number
}

export interface Transaction {
  id: number
  date: string
  type: TransactionType
  category?: string
  description?: string
  amount: number
  order_id?: number
  created_by?: number
  created_at: string
}

export interface Document {
  id: number
  name: string
  type?: string
  file_path: string
  file_size?: number
  mime_type?: string
  related_to?: string
  related_id?: number
  notes?: string
  uploaded_at: string
}

export interface User {
  id: number
  username: string
  role: UserRole
  operator_id?: number
  active: boolean
  created_at: string
}
