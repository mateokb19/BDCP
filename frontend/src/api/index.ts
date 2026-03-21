import type { Service, Operator } from '@/types'

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── API response types (mirror backend schemas) ────────────────────────────────

export interface ApiVehicle {
  id: number
  type: string
  brand?: string
  model?: string
  plate: string
  color?: string
  client_id?: number
}

export interface ApiOrderItem {
  id: number
  service_id?: number
  service_name: string
  service_category: string
  unit_price: number
  quantity: number
  subtotal: number
}

export interface ApiOrder {
  id: number
  order_number: string
  date: string
  vehicle_id: number
  operator_id?: number
  status: string
  subtotal: number
  total: number
  paid: boolean
  items: ApiOrderItem[]
}

export interface ApiPatioEntry {
  id: number
  order_id: number
  vehicle_id: number
  position?: number
  status: string
  entered_at: string
  started_at?: string
  completed_at?: string
  delivered_at?: string
  notes?: string
  vehicle?: ApiVehicle
  order?: ApiOrder
}

export interface OrderCreatePayload {
  vehicle_type: string
  plate: string
  brand: string
  model?: string
  color?: string
  client_name: string
  client_phone: string
  operator_id?: number | null
  service_ids: number[]
  notes?: string
}

export interface PatioPatchPayload {
  color?: string | null
  operator_id?: number | null
  notes?: string | null
  service_ids?: number[]
}

export interface ApiCeramicVehicle {
  plate: string
  brand?: string
  model?: string
  color?: string
  type:   string
}

export interface ApiCeramicOperator {
  id:   number
  name: string
}

export interface ApiCeramicTreatment {
  id:               number
  order_id?:        number
  vehicle_id:       number
  service_id?:      number
  treatment_type:   string
  operator_id?:     number
  application_date: string
  next_maintenance?: string
  notes?:           string
  created_at:       string
  vehicle?:         ApiCeramicVehicle
  operator?:        ApiCeramicOperator
}

export interface ApiLiqWeekOrderItem {
  service_name: string
  unit_price:   string
  quantity:     number
  subtotal:     string
}

export interface ApiLiqWeekOrder {
  order_id:      number
  order_number:  string
  patio_status:  string
  vehicle_plate: string
  vehicle_brand?: string
  vehicle_model?: string
  items:         ApiLiqWeekOrderItem[]
  total:         string
}

export interface ApiLiqWeekDay {
  date:         string
  day_name:     string
  orders:       ApiLiqWeekOrder[]
  day_total:    string
  day_services: number
}

export interface ApiLiqWeekResponse {
  operator_id:               number
  operator_name:             string
  commission_rate:           string
  week_start:                string
  week_end:                  string
  days:                      ApiLiqWeekDay[]
  week_total:                string
  week_services:             number
  commission_amount:         string
  is_liquidated:             boolean
  liquidated_at?:            string
  net_amount?:               string
  payment_transfer_amount?:  string
  payment_cash_amount?:      string
  amount_pending?:           string
}

export interface ApiDebtPayment {
  id:         number
  debt_id:    number
  amount:     string
  notes?:     string
  created_at: string
}

export interface ApiDebt {
  id:          number
  operator_id: number
  direction:   'empresa_operario' | 'operario_empresa'
  amount:      string
  paid_amount: string
  description?: string
  paid:        boolean
  created_at:  string
  payments:    ApiDebtPayment[]
}

export interface DebtCreatePayload {
  direction:   'empresa_operario' | 'operario_empresa'
  amount:      number
  description?: string
}

export interface LiquidatePayload {
  abonos:              { debt_id: number; amount: number }[]
  company_settlements: { debt_id: number; amount: number }[]
  payment_transfer:    number
  payment_cash:        number
}

export interface ApiHistorialItem {
  service_name:     string
  service_category: string
  unit_price:       string
  quantity:         number
  subtotal:         string
}

export interface ApiHistorialVehicle {
  plate: string
  brand?: string
  model?: string
  color?: string
  type:   string
  client?: { name: string; phone?: string }
}

export interface ApiHistorialOperator {
  id:   number
  name: string
}

export interface ApiHistorialEntry {
  id:           number
  order_number: string
  date:         string
  status:       string
  total?:       string
  vehicle?:     ApiHistorialVehicle
  items:        ApiHistorialItem[]
  operator?:    ApiHistorialOperator
}

// ── API methods ────────────────────────────────────────────────────────────────

export const api = {
  services: {
    list: () => apiFetch<Service[]>('/services'),
  },
  operators: {
    list: () => apiFetch<Operator[]>('/operators'),
  },
  vehicles: {
    byPlate: (plate: string) =>
      apiFetch<ApiVehicle>(`/vehicles/by-plate/${encodeURIComponent(plate)}`),
  },
  orders: {
    create: (payload: OrderCreatePayload) =>
      apiFetch<ApiOrder>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  },
  patio: {
    list: () => apiFetch<ApiPatioEntry[]>('/patio'),
    advance: (id: number) =>
      apiFetch<ApiPatioEntry>(`/patio/${id}/advance`, { method: 'POST' }),
    edit: (id: number, payload: PatioPatchPayload) =>
      apiFetch<ApiPatioEntry>(`/patio/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  },
  ceramics: {
    list: () => apiFetch<ApiCeramicTreatment[]>('/ceramics'),
  },
  history: {
    list: (params?: { date_filter?: string; search?: string }) => {
      const qs = new URLSearchParams()
      if (params?.date_filter) qs.set('date_filter', params.date_filter)
      if (params?.search)      qs.set('search', params.search)
      const query = qs.toString() ? `?${qs}` : ''
      return apiFetch<ApiHistorialEntry[]>(`/history${query}`)
    },
  },
  liquidation: {
    getWeek: (opId: number, weekStart: string) =>
      apiFetch<ApiLiqWeekResponse>(`/liquidation/${opId}/week?week_start=${weekStart}`),
    listDebts: (opId: number) =>
      apiFetch<ApiDebt[]>(`/liquidation/${opId}/debts`),
    createDebt: (opId: number, payload: DebtCreatePayload) =>
      apiFetch<ApiDebt>(`/liquidation/${opId}/debts`, { method: 'POST', body: JSON.stringify(payload) }),
    markDebtPaid: (debtId: number) =>
      apiFetch<ApiDebt>(`/liquidation/debts/${debtId}/paid`, { method: 'PATCH' }),
    liquidate: (opId: number, weekStart: string, payload: LiquidatePayload) =>
      apiFetch<ApiLiqWeekResponse>(`/liquidation/${opId}/liquidate?week_start=${weekStart}`, { method: 'POST', body: JSON.stringify(payload) }),
  },
}
