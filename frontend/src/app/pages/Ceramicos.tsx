import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ShieldCheck, ShieldAlert, ShieldOff, User, Phone } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { VehicleTypeIcon } from '@/app/components/ui/VehicleTypeIcon'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiCeramicTreatment } from '@/api'

const TODAY = new Date()
const MAINT_DAYS = 180 // 6-month maintenance cycle

type FilterKey = 'all' | 'active' | 'expiring' | 'expired'

const TREATMENT_ABBREV: Record<string, string> = {
  'Superior Shine +9 EXCLUSIVE': 'SS +9 EXC',
  'Superior Shine +9':           'SS +9',
  'Superior Shine +5':           'SS +5',
  'Superior Shine +2':           'SS +2',
}

const TREATMENT_VARIANT: Record<string, 'purple' | 'yellow' | 'blue' | 'default'> = {
  'Superior Shine +9 EXCLUSIVE': 'purple',
  'Superior Shine +9':           'yellow',
  'Superior Shine +5':           'blue',
  'Superior Shine +2':           'default',
}

function getMaintStatus(nextMaint?: string): FilterKey {
  if (!nextMaint) return 'active'
  const days = differenceInDays(parseISO(nextMaint), TODAY)
  if (days < 0)   return 'expired'
  if (days <= 60) return 'expiring'
  return 'active'
}

function statusBadge(status: FilterKey) {
  if (status === 'expired')  return { label: 'Vencido',    variant: 'red'    as const, Icon: ShieldOff  }
  if (status === 'expiring') return { label: 'Por Vencer', variant: 'orange' as const, Icon: ShieldAlert }
  return                            { label: 'Vigente',    variant: 'green'  as const, Icon: ShieldCheck }
}

const stagger  = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const cardAnim = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.22 } } }

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'Todos'      },
  { key: 'active',   label: 'Vigentes'   },
  { key: 'expiring', label: 'Por Vencer' },
  { key: 'expired',  label: 'Vencidos'   },
]

export default function Ceramicos() {
  const [filter,    setFilter]    = useState<FilterKey>('all')
  const [records,   setRecords]   = useState<ApiCeramicTreatment[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    api.ceramics.list()
      .then(setRecords)
      .catch(err => toast.error(err.message ?? 'Error al cargar cerámicos'))
      .finally(() => setLoading(false))
  }, [])

  const enriched = records.map(c => {
    const status      = getMaintStatus(c.next_maintenance)
    const daysToMaint = c.next_maintenance
      ? differenceInDays(parseISO(c.next_maintenance), TODAY)
      : null
    const elapsed = daysToMaint !== null ? MAINT_DAYS - daysToMaint : MAINT_DAYS
    const pct     = Math.min(Math.max((elapsed / MAINT_DAYS) * 100, 0), 100)
    return { ...c, status, daysToMaint, pct }
  })

  const counts: Record<FilterKey, number> = {
    all:      enriched.length,
    active:   enriched.filter(c => c.status === 'active').length,
    expiring: enriched.filter(c => c.status === 'expiring').length,
    expired:  enriched.filter(c => c.status === 'expired').length,
  }

  const filtered = filter === 'all' ? enriched : enriched.filter(c => c.status === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Cargando cerámicos...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Cerámicos"
        subtitle={`${enriched.length} tratamientos registrados`}
      />

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200',
              filter === f.key
                ? 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/8 hover:text-gray-200'
            )}>
            {f.label}
            <motion.span
              key={counts[f.key]}
              initial={{ scale: 1.2 }} animate={{ scale: 1 }}
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs',
                filter === f.key ? 'bg-yellow-500/25 text-yellow-300' : 'bg-white/10 text-gray-500'
              )}>
              {counts[f.key]}
            </motion.span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={filter}
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.length === 0 ? (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <EmptyState
                icon={Sparkles}
                title="Sin tratamientos"
                description={
                  enriched.length === 0
                    ? 'Los cerámicos aplicados aparecerán aquí automáticamente'
                    : `No hay cerámicos en la categoría "${FILTERS.find(f => f.key === filter)?.label}"`
                }
              />
            </div>
          ) : (
            filtered.map(c => {
              const sb      = statusBadge(c.status)
              const SIcon   = sb.Icon
              const abbrev  = TREATMENT_ABBREV[c.treatment_type] ?? c.treatment_type
              const tVariant = TREATMENT_VARIANT[c.treatment_type] ?? 'default'
              const barColor = c.status === 'expired'  ? 'bg-red-500'
                             : c.status === 'expiring' ? 'bg-orange-400'
                             : 'bg-green-500'

              return (
                <motion.div key={c.id} variants={cardAnim} layout>
                  <GlassCard padding className="space-y-3">

                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="rounded-xl bg-white/8 p-2 shrink-0">
                          <VehicleTypeIcon
                            type={(c.vehicle?.type ?? 'automovil') as any}
                            size={18}
                            className="text-gray-300"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {c.vehicle?.brand} {c.vehicle?.model}
                          </p>
                          <p className="text-xs text-gray-500">
                            {c.vehicle?.plate}{c.vehicle?.color ? ` · ${c.vehicle.color}` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant={tVariant} className="shrink-0">{abbrev}</Badge>
                    </div>

                    {/* Client */}
                    {c.vehicle?.client && (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User size={12} className="text-gray-600 shrink-0" />
                          <span className="text-xs text-gray-300 truncate">{c.vehicle.client.name}</span>
                        </div>
                        {c.vehicle.client.phone && (
                          <a
                            href={`tel:${c.vehicle.client.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors shrink-0"
                          >
                            <Phone size={11} />
                            {c.vehicle.client.phone}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Info row */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-600 mb-0.5">Aplicado</p>
                        <p className="text-gray-300">
                          {format(parseISO(c.application_date), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-0.5">Operario</p>
                        <p className="text-gray-300">{c.operator?.name ?? '—'}</p>
                      </div>
                    </div>

                    {/* Maintenance progress */}
                    <div className="space-y-1.5 pt-1 border-t border-white/6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <SIcon size={13} className={cn(
                            sb.variant === 'green'  ? 'text-green-400' :
                            sb.variant === 'orange' ? 'text-orange-400' : 'text-red-400'
                          )} />
                          <Badge variant={sb.variant}>{sb.label}</Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          {c.daysToMaint !== null
                            ? c.daysToMaint < 0
                              ? `Venció hace ${Math.abs(c.daysToMaint)}d`
                              : c.daysToMaint === 0 ? 'Vence hoy'
                              : `${c.daysToMaint}d restantes`
                            : '—'}
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${c.pct}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                          className={cn('h-full rounded-full', barColor)}
                        />
                      </div>

                      <p className="text-[11px] text-gray-600">
                        Próximo mantenimiento:{' '}
                        {c.next_maintenance
                          ? format(parseISO(c.next_maintenance), "d MMM yyyy", { locale: es })
                          : '—'}
                      </p>
                    </div>

                  </GlassCard>
                </motion.div>
              )
            })
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
