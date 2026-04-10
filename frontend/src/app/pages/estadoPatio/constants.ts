import type { PatioStatus } from '@/types'

export const FACTURA_KEY = 'bdcpolo_facturas'

export const COLUMNS: { status: PatioStatus; label: string; color: string; border: string; dot: string }[] = [
  { status: 'esperando',  label: 'Esperando',  color: 'text-orange-400', border: 'border-t-orange-500/60', dot: 'bg-orange-500' },
  { status: 'en_proceso', label: 'En Proceso', color: 'text-blue-400',   border: 'border-t-blue-500/60',   dot: 'bg-blue-500'   },
  { status: 'listo',      label: 'Listo',      color: 'text-green-400',  border: 'border-t-green-500/60',  dot: 'bg-green-500'  },
  { status: 'entregado',  label: 'Entregado',  color: 'text-gray-400',   border: 'border-t-gray-500/60',   dot: 'bg-gray-500'   },
]

export const NEXT_STATUS: Record<PatioStatus, PatioStatus | null> = {
  esperando:  'en_proceso',
  en_proceso: 'listo',
  listo:      'entregado',
  entregado:  null,
}

export const NEXT_LABEL: Record<PatioStatus, string> = {
  esperando:  'Iniciar',
  en_proceso: 'Completar',
  listo:      'Entregar',
  entregado:  'Entregado',
}

export const DELIVERY_HOURS = Array.from({ length: 10 }, (_, i) => i + 8)

export const CATEGORY_LABELS: Record<string, string> = {
  exterior:           'Exterior',
  interior:           'Interior',
  ceramico:           'Cerámico',
  correccion_pintura: 'Corrección de Pintura',
  latoneria:          'Latonería',
  pintura:            'Pintura',
  ppf:                'PPF',
  polarizado:         'Polarizado',
}

export const CATEGORY_ORDER: string[] = [
  'exterior', 'interior', 'correccion_pintura', 'ceramico',
  'latoneria', 'pintura', 'ppf', 'polarizado',
]

// Maps service category → operator_type
export const CAT_TO_OP_TYPE: Record<string, string> = {
  exterior:           'detallado',
  interior:           'detallado',
  ceramico:           'detallado',
  correccion_pintura: 'detallado',
  pintura:            'pintura',
  latoneria:          'latoneria',
  ppf:                'ppf',
  polarizado:         'polarizado',
  otro:               'otro',
}

export const OP_TYPE_LABEL: Record<string, string> = {
  detallado:  'Detallado',
  pintura:    'Pintura',
  latoneria:  'Latonería',
  ppf:        'PPF',
  polarizado: 'Polarizado',
}

// Operator types handled as third-party payments — no internal operator needed
export const NO_OPERATOR_TYPES = new Set(['ppf', 'polarizado', 'otro'])
