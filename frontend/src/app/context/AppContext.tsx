import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '@/api'
import type { Service, Operator, VehicleType } from '@/types'

export interface NewOrderPayload {
  vehicleType: VehicleType
  plate: string
  brand: string
  model: string
  color: string
  clientName: string
  clientPhone: string
  operatorId: number | null
  serviceIds: number[]
  notes?: string
}

interface AppCtx {
  services: Service[]
  operators: Operator[]
  loading: boolean
  createOrder: (data: NewOrderPayload) => Promise<string>
}

const AppContext = createContext<AppCtx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [services,  setServices]  = useState<Service[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([api.services.list(), api.operators.list()])
      .then(([svcs, ops]) => { setServices(svcs); setOperators(ops) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function createOrder(data: NewOrderPayload): Promise<string> {
    const order = await api.orders.create({
      vehicle_type: data.vehicleType,
      plate:        data.plate,
      brand:        data.brand,
      model:        data.model   || undefined,
      color:        data.color   || undefined,
      client_name:  data.clientName,
      client_phone: data.clientPhone,
      operator_id:  data.operatorId,
      service_ids:  data.serviceIds,
      notes:        data.notes,
    })
    return order.order_number
  }

  return (
    <AppContext.Provider value={{ services, operators, loading, createOrder }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
