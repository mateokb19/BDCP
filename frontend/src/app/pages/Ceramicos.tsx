import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ShieldCheck, ShieldAlert, ShieldOff, CalendarClock } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { mockCeramics, getVehicleById, getOperatorById } from '@/data/mock'
import type { CeramicTreatment } from '@/types'

const TODAY = new Date(2026, 2, 18) // March 18, 2026

type FilterKey = 'all' | 'active' | 'expiring' | 'expired'

function getWarrantyStatus(c: CeramicTreatment): FilterKey {
  if (!c.warranty_expiry) return 'active'
  const days = differenceInDays(parseISO(c.warranty_expiry), TODAY)
  if (days < 0)   return 'expired'
  if (days <= 30) return 'expiring'
  return 'active'
}

function warrantyBadge(status: FilterKey) {
  if (status === 'expired')  return { label: 'Vencida',      variant: 'red'    as const, Icon: ShieldOff  }
  if (status === 'expiring') return { label: 'Por Vencer',   variant: 'orange' as const, Icon: ShieldAlert }
  return                            { label: 'Vigente',      variant: 'green'  as const, Icon: ShieldCheck }
}

function treatmentVariant(type: string): 'default' | 'yellow' | 'purple' {
  if (type === 'Elite')   return 'purple'
  if (type === 'Premium') return 'yellow'
  return 'default'
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const cardAnim = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.25 } } }

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'Todos'      },
  { key: 'active',   label: 'Vigentes'   },
  { key: 'expiring', label: 'Por Vencer' },
  { key: 'expired',  label: 'Vencidos'   },
]

export default function Ceramicos() {
  const [filter, setFilter] = useState<FilterKey>('all')

  const enriched = mockCeramics.map(c => ({
    ...c,
    vehicle:  getVehicleById(c.vehicle_id),
    operator: c.operator_id ? getOperatorById(c.operator_id) : null,
    status:   getWarrantyStatus(c),
    days:     c.warranty_expiry ? differenceInDays(parseISO(c.warranty_expiry), TODAY) : null,
  }))

  const counts: Record<FilterKey, number> = {
    all:      enriched.length,
    active:   enriched.filter(c => c.status === 'active').length,
    expiring: enriched.filter(c => c.status === 'expiring').length,
    expired:  enriched.filter(c => c.status === 'expired').length,
  }

  const filtered = filter === 'all' ? enriched : enriched.filter(c => c.status === filter)

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Cerámicos"
        subtitle={`${enriched.length} tratamientos registrados`}
      />

      {/* Filter tabs */}
      <div className="overflow-x-auto pb-1 -mb-1 mb-6">
        <div className="flex gap-2 min-w-max">
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
              <EmptyState icon={Sparkles} title="Sin tratamientos" description={`No hay cerámicos en la categoría "${FILTERS.find(f => f.key === filter)?.label}"`} />
            </div>
          ) : (
            filtered.map(c => {
              const ws = warrantyBadge(c.status)
              const WIcon = ws.Icon

              // warranty progress bar
              const totalDays  = c.warranty_months * 30
              const elapsed    = c.warranty_expiry ? totalDays - (c.days ?? 0) : totalDays
              const pct        = Math.min(Math.max((elapsed / totalDays) * 100, 0), 100)
              const barColor   = c.status === 'expired' ? 'bg-red-500' : c.status === 'expiring' ? 'bg-yellow-500' : 'bg-green-500'

              return (
                <motion.div key={c.id} variants={cardAnim} layout>
                  <GlassCard padding className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-yellow-500/10 p-2">
                          <Sparkles size={18} className="text-yellow-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{c.vehicle?.brand} {c.vehicle?.model}</span>
                          </div>
                          <div className="text-xs text-gray-500">{c.vehicle?.plate} · {c.vehicle?.color}</div>
                        </div>
                      </div>
                      <Badge variant={treatmentVariant(c.treatment_type)}>{c.treatment_type}</Badge>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-600 mb-0.5">Aplicado</p>
                        <p className="text-gray-300">{format(parseISO(c.application_date), "d MMM yyyy", { locale: es })}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-0.5">Operario</p>
                        <p className="text-gray-300">{c.operator?.name ?? '—'}</p>
                      </div>
                      {c.warranty_expiry && (
                        <div className="col-span-2 flex items-center gap-1.5">
                          <CalendarClock size={12} className="text-gray-500" />
                          <span className="text-gray-500">
                            Vence: {format(parseISO(c.warranty_expiry), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Warranty progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs">
                          <WIcon size={13} className={cn(
                            ws.variant === 'green' ? 'text-green-400' :
                            ws.variant === 'orange' ? 'text-orange-400' : 'text-red-400'
                          )} />
                          <Badge variant={ws.variant}>{ws.label}</Badge>
                        </div>
                        <span className="text-xs text-gray-500">{c.warranty_months} meses</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          className={cn('h-full rounded-full', barColor)}
                        />
                      </div>
                      {c.days !== null && (
                        <p className="text-xs text-gray-600">
                          {c.days < 0
                            ? `Venció hace ${Math.abs(c.days)} días`
                            : c.days === 0 ? 'Vence hoy'
                            : `${c.days} días restantes`}
                        </p>
                      )}
                    </div>

                    {c.notes && (
                      <p className="text-xs text-gray-600 border-t border-white/6 pt-3">{c.notes}</p>
                    )}
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
