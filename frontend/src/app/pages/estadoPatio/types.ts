import type { ApiPatioEntry } from '@/api'

export interface FacturaRecord {
  tipo:      'persona_natural' | 'empresa'
  id_type:   string
  id_number: string
  dv:        string
  name:      string
  phone:     string
  email:     string
}

export interface EditForm {
  serviceIds:      number[]
  customPrices:    Record<number, string>
  operatorByType:  Record<string, string>   // operator_type → operator_id string
  latOperatorPays: Record<number, string>   // service_id → operator pay amount string
}

export interface PatioCardProps {
  entry:          ApiPatioEntry
  opName?:        string
  facturaRecord?: FacturaRecord
  onAdvance:      (entry: ApiPatioEntry) => void
  onEdit:         (entry: ApiPatioEntry) => void
  onUpdate:       (updated: ApiPatioEntry) => void
}
