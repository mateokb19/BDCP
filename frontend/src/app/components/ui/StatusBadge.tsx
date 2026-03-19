import { Badge } from './Badge'
import type { OrderStatus, PatioStatus, AppointmentStatus, LiquidationStatus } from '@/types'

type AnyStatus = OrderStatus | PatioStatus | AppointmentStatus | LiquidationStatus

const statusConfig: Record<AnyStatus, { label: string; variant: 'default' | 'yellow' | 'green' | 'red' | 'blue' | 'orange' | 'purple' }> = {
  // OrderStatus
  pendiente:   { label: 'Pendiente',    variant: 'orange' },
  en_proceso:  { label: 'En Proceso',   variant: 'blue'   },
  listo:       { label: 'Listo',        variant: 'green'  },
  entregado:   { label: 'Entregado',    variant: 'default'},
  cancelado:   { label: 'Cancelado',    variant: 'red'    },
  // AppointmentStatus
  programada:  { label: 'Programada',   variant: 'yellow' },
  confirmada:  { label: 'Confirmada',   variant: 'blue'   },
  completada:  { label: 'Completada',   variant: 'green'  },
  cancelada:   { label: 'Cancelada',    variant: 'red'    },
  no_asistio:  { label: 'No Asistió',   variant: 'red'    },
  // LiquidationStatus
  pagada:      { label: 'Pagada',       variant: 'green'  },
  // PatioStatus (reuses: pendiente, en_proceso, listo, entregado, esperando)
  esperando:   { label: 'Esperando',    variant: 'orange' },
}

interface StatusBadgeProps {
  status: AnyStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'default' as const }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
