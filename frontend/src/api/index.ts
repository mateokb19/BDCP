import type { Service, Operator } from '@/types'

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:28000/api/v1'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = Array.isArray(data.detail)
      ? data.detail.map((e: any) => e.msg ?? JSON.stringify(e)).join(', ')
      : typeof data.detail === 'string'
        ? data.detail
        : `HTTP ${res.status}`
    throw new Error(detail)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
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
  client?: {
    id: number
    name: string
    phone?: string
    email?: string
    tipo_persona?: string
    tipo_identificacion?: string
    identificacion?: string
    dv?: string
  }
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
  downpayment: string
  is_warranty: boolean
  payment_cash: string
  payment_datafono: string
  payment_nequi: string
  payment_bancolombia: string
  latoneria_operator_pay?: string
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
  scheduled_delivery_at?: string
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
  item_overrides?: { service_id: number; unit_price: number; custom_name?: string }[]
  scheduled_delivery_at?: string
  downpayment?: number
  downpayment_method?: string
  is_warranty?: boolean
}

export interface PatioPatchPayload {
  color?: string | null
  operator_id?: number | null
  notes?: string | null
  service_ids?: number[]
  scheduled_delivery_at?: string | null
}

export interface ApiCeramicClient {
  id:     number
  name:   string
  phone?: string
  email?: string
}

export interface ApiCeramicVehicle {
  plate:   string
  brand?:  string
  model?:  string
  color?:  string
  type:    string
  client?: ApiCeramicClient
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
  service_name:     string
  service_category: string
  unit_price:       string
  standard_price?:  string
  quantity:         number
  subtotal:         string
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
  piece_count?:  string
  latoneria_operator_pay?: string
  is_liquidated: boolean
  commission_base?: string
  ceramic_bonus?:   string
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
  operator_type:             string
  commission_rate:           string
  week_start:                string
  week_end:                  string
  days:                      ApiLiqWeekDay[]
  week_total:                string
  commission_base:           string
  week_services:             number
  piece_count?:              string
  commission_amount:         string
  is_liquidated:             boolean
  unliquidated_count:        number
  liquidated_at?:               string
  net_amount?:                  string
  payment_cash_amount?:         string
  payment_datafono_amount?:     string
  payment_nequi_amount?:        string
  payment_bancolombia_amount?:  string
  amount_pending?:              string
  ceramic_bonus_total?:         string
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
  payment_cash:        number
  payment_datafono:    number
  payment_nequi:       number
  payment_bancolombia: number
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
  id:                  number
  order_number:        string
  date:                string
  status:              string
  total?:              string
  vehicle?:            ApiHistorialVehicle
  items:               ApiHistorialItem[]
  operator?:           ApiHistorialOperator
  payment_cash?:       string
  payment_datafono?:   string
  payment_nequi?:      string
  payment_bancolombia?: string
}

export interface ApiAppointment {
  id:           number
  date:         string
  time?:        string
  vehicle_type?: string
  brand?:       string
  model?:       string
  plate?:       string
  client_name?: string
  client_phone?: string
  comments?:    string
  status:       string
  order_id?:    number
  created_at:   string
  updated_at:   string
}

export interface AppointmentCreatePayload {
  date:          string
  time?:         string
  vehicle_type?: string
  brand?:        string
  model?:        string
  plate?:        string
  client_name:   string
  client_phone?: string
  comments?:     string
}

export interface AppointmentPatchPayload {
  date?:         string
  time?:         string
  vehicle_type?: string
  brand?:        string
  model?:        string
  plate?:        string
  client_name?:  string
  client_phone?: string
  comments?:     string
  status?:       string
}

export interface ApiReportOrderItem {
  service_name:     string
  service_category: string
  unit_price:       string
  quantity:         number
  subtotal:         string
}

export interface ApiReportOrder {
  order_number:           string
  date:                   string
  vehicle_plate:          string
  vehicle_brand?:         string
  vehicle_model?:         string
  items:                  ApiReportOrderItem[]
  total:                  string
  piece_count?:           string
  latoneria_operator_pay?: string
  is_liquidated:          boolean
  commission_base?:       string
  ceramic_bonus?:         string
}

export interface ApiReportWeekStatus {
  week_start:          string
  week_end:            string
  is_liquidated:       boolean
  week_gross:          string
  week_commission:     string
  week_pieces?:        string
  net_amount?:         string
  payment_cash?:       string
  payment_datafono?:   string
  payment_nequi?:      string
  payment_bancolombia?: string
  amount_pending?:     string
}

export interface ApiReportPendingDebt {
  description?: string
  amount:       string
  paid_amount:  string
  remaining:    string
}

export interface ApiReportResponse {
  operator_id:        number
  operator_name:      string
  operator_type:      string
  commission_rate:    string
  period_label:       string
  date_start:         string
  date_end:           string
  orders:             ApiReportOrder[]
  total_services:     number
  gross_total:        string
  total_pieces?:      string
  commission_amount:  string
  week_statuses:      ApiReportWeekStatus[]
  pending_debts:      ApiReportPendingDebt[]
  total_pending_owed: string
}

export interface ApiIngresosDayTotal {
  date:                string
  total:               string
  payment_cash:        string
  payment_datafono:    string
  payment_nequi:       string
  payment_bancolombia: string
}

export interface ApiIngresosResponse {
  date_start:          string
  date_end:            string
  total:               string
  order_count:         number
  payment_cash:        string
  payment_datafono:    string
  payment_nequi:       string
  payment_bancolombia: string
  daily_totals:        ApiIngresosDayTotal[]
}

export interface ApiIngresoBreakdownItem {
  order_number: string
  date:         string
  plate:        string
  vehicle:      string
  client:       string
  amount:       number
  is_abono:     boolean
}

export interface ApiExpense {
  id:              number
  date:            string
  amount:          string
  category?:       string
  description?:    string
  payment_method?: string
  notes?:          string
  created_at:      string
}

export interface ExpenseCreatePayload {
  date:            string
  amount:          number
  category?:       string
  description?:    string
  payment_method?: string
  notes?:          string
}

export interface ApiClientVehicle {
  id:     number
  plate:  string
  brand?: string
  model?: string
  type:   string
  color?: string
}

export interface ApiClient {
  id:                   number
  name:                 string
  phone?:               string
  email?:               string
  tipo_persona?:        string
  tipo_identificacion?: string
  identificacion?:      string
  dv?:                  string
  notes?:               string
  created_at:           string
  vehicles:             ApiClientVehicle[]
  order_count:          number
  total_spent:          string
  last_service?:        string
}

export interface ClientPatchPayload {
  name?:                string
  phone?:               string
  email?:               string
  tipo_persona?:        string
  tipo_identificacion?: string
  identificacion?:      string
  dv?:                  string
  notes?:               string
}

// ── API methods ────────────────────────────────────────────────────────────────

export const api = {
  services: {
    list: () => apiFetch<Service[]>('/services'),
  },
  operators: {
    list: (includeInactive = false) =>
      apiFetch<Operator[]>(`/operators${includeInactive ? '?include_inactive=true' : ''}`),
    create: (payload: { name: string; phone?: string; cedula?: string; commission_rate: number }) =>
      apiFetch<Operator>('/operators', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: number, payload: { name?: string; phone?: string; cedula?: string; commission_rate?: number; active?: boolean }) =>
      apiFetch<Operator>(`/operators/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
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
    advance: (id: number, payment?: { payment_cash: number; payment_datafono: number; payment_nequi: number; payment_bancolombia: number; latoneria_operator_pay?: number }) =>
      apiFetch<ApiPatioEntry>(`/patio/${id}/advance`, { method: 'POST', body: JSON.stringify(payment ?? {}) }),
    edit: (id: number, payload: PatioPatchPayload) =>
      apiFetch<ApiPatioEntry>(`/patio/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    cancel: (id: number) =>
      apiFetch<void>(`/patio/${id}`, { method: 'DELETE' }),
  },
  ceramics: {
    list: () => apiFetch<ApiCeramicTreatment[]>('/ceramics'),
  },
  history: {
    list: (params?: { date_filter?: string; date_from?: string; date_to?: string; search?: string }) => {
      const qs = new URLSearchParams()
      if (params?.date_filter) qs.set('date_filter', params.date_filter)
      if (params?.date_from)   qs.set('date_from',   params.date_from)
      if (params?.date_to)     qs.set('date_to',     params.date_to)
      if (params?.search)      qs.set('search', params.search)
      const query = qs.toString() ? `?${qs}` : ''
      return apiFetch<ApiHistorialEntry[]>(`/history${query}`)
    },
  },
  appointments: {
    list: (month?: string) => {
      const qs = month ? `?month=${month}` : ''
      return apiFetch<ApiAppointment[]>(`/appointments${qs}`)
    },
    create: (payload: AppointmentCreatePayload) =>
      apiFetch<ApiAppointment>('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
    patch: (id: number, payload: AppointmentPatchPayload) =>
      apiFetch<ApiAppointment>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    delete: (id: number) =>
      apiFetch<void>(`/appointments/${id}`, { method: 'DELETE' }),
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
    getPending: (opId: number) =>
      apiFetch<ApiLiqWeekResponse>(`/liquidation/${opId}/pending`),
    liquidatePending: (opId: number, payload: LiquidatePayload) =>
      apiFetch<ApiLiqWeekResponse>(`/liquidation/${opId}/liquidate-pending`, { method: 'POST', body: JSON.stringify(payload) }),
    payDebts: (opId: number, payload: LiquidatePayload) =>
      apiFetch<ApiDebt[]>(`/liquidation/${opId}/pay-debts`, { method: 'POST', body: JSON.stringify(payload) }),
    getReport: (opId: number, period: 'week' | 'month', refDate?: string) => {
      const qs = new URLSearchParams({ period })
      if (refDate) qs.set('ref_date', refDate)
      return apiFetch<ApiReportResponse>(`/liquidation/${opId}/report?${qs}`)
    },
  },
  ingresos: {
    get: (period: 'day' | 'week' | 'month' | 'year', refDate?: string) => {
      const qs = new URLSearchParams({ period })
      if (refDate) qs.set('ref_date', refDate)
      return apiFetch<ApiIngresosResponse>(`/ingresos?${qs}`)
    },
    breakdown: (method: string, dateStart: string, dateEnd: string) => {
      const qs = new URLSearchParams({ method, date_start: dateStart, date_end: dateEnd })
      return apiFetch<ApiIngresoBreakdownItem[]>(`/ingresos/breakdown?${qs}`)
    },
  },
  egresos: {
    list: (params?: { date_start?: string; date_end?: string }) => {
      const qs = new URLSearchParams()
      if (params?.date_start) qs.set('date_start', params.date_start)
      if (params?.date_end)   qs.set('date_end',   params.date_end)
      const query = qs.toString() ? `?${qs}` : ''
      return apiFetch<ApiExpense[]>(`/egresos${query}`)
    },
    create: (payload: ExpenseCreatePayload) =>
      apiFetch<ApiExpense>('/egresos', { method: 'POST', body: JSON.stringify(payload) }),
    delete: (id: number) =>
      apiFetch<void>(`/egresos/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: (search?: string) => {
      const qs = search ? `?search=${encodeURIComponent(search)}` : ''
      return apiFetch<ApiClient[]>(`/clients${qs}`)
    },
    patch: (id: number, payload: ClientPatchPayload) =>
      apiFetch<ApiClient>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  },
}
