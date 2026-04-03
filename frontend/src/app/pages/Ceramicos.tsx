import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ShieldCheck, ShieldAlert, ShieldOff, Info, Phone, User, Wrench, Clock, ChevronDown } from 'lucide-react'
import { format, parseISO, differenceInDays, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { VehicleTypeIcon } from '@/app/components/ui/VehicleTypeIcon'
import { Modal } from '@/app/components/ui/Modal'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiCeramicTreatment } from '@/api'

const TODAY = new Date()
const MAINT_DAYS = 180 // 6-month maintenance cycle
const GRACE_DAYS = 30  // strict 1-month grace period

type FilterKey = 'all' | 'active' | 'expiring' | 'grace' | 'expired'
type DotState  = 'done' | 'missed' | 'grace' | 'current' | 'pending'

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

const TREATMENT_YEARS: Record<string, number> = {
  'Superior Shine +9 EXCLUSIVE': 9,
  'Superior Shine +9':           9,
  'Superior Shine +5':           5,
  'Superior Shine +2':           2,
}

interface MaintInfo {
  currentMaint:    number
  totalMaint:      number
  daysToMaint:     number | null  // days to theoretical due date (negative when overdue)
  pct:             number         // 0–100 progress within current cycle (toward due date)
  gracePct:        number         // 0–100 grace period consumed
  daysGraceLeft:   number         // days left in grace period
  nextCyclePct:    number         // 0–100 progress into the next 6-month cycle (counted from due date)
  daysToNextCycle: number         // days remaining until next cycle's due date
  nextMaintDate:   string | null
  done:            boolean
  inGrace:         boolean
  dots:            DotState[]
}

// Returns the most recent maintenance date inside [cStart, graceEnd] that is ≤ today
function maintInCycle(maintDates: Date[], cStart: Date, graceEnd: Date): Date | null {
  const matches = maintDates.filter(d => d >= cStart && d <= graceEnd && d <= TODAY)
  if (!matches.length) return null
  return matches.reduce((a, b) => (b > a ? b : a))
}

function getMaintenanceInfo(
  treatment_type: string,
  application_date: string,
  maintenance_dates: string[],
): MaintInfo {
  const appDate    = parseISO(application_date)
  const years      = TREATMENT_YEARS[treatment_type] ?? 2
  const totalMaint = years * 2
  // Only consider maintenance events that have already happened
  const maintDates = maintenance_dates.map(d => parseISO(d)).filter(d => d <= TODAY)

  // Advance to next cycle only after the grace period of the current one expires
  let cycleIndex = 0
  for (let i = 0; i < totalMaint; i++) {
    const graceEnd = addMonths(addMonths(appDate, (i + 1) * 6), 1)
    if (TODAY > graceEnd) cycleIndex = i + 1
    else break
  }

  // Past full treatment duration — resolve all past dots
  if (cycleIndex >= totalMaint) {
    const dots: DotState[] = Array.from({ length: totalMaint }, (_, i) => {
      const cStart = addMonths(appDate, i * 6)
      const grace  = addMonths(addMonths(appDate, (i + 1) * 6), 1)
      return maintInCycle(maintDates, cStart, grace) ? 'done' : 'missed'
    })
    return { currentMaint: totalMaint, totalMaint, daysToMaint: null, pct: 100, gracePct: 0, daysGraceLeft: 0, nextCyclePct: 0, daysToNextCycle: 0, nextMaintDate: null, done: true, inGrace: false, dots }
  }

  // Current cycle window
  const cycleStart = addMonths(appDate, cycleIndex * 6)
  const cycleDue   = addMonths(appDate, (cycleIndex + 1) * 6)
  const graceEnd   = addMonths(cycleDue, 1)
  const daysToMaint = differenceInDays(cycleDue, TODAY)
  const inGrace    = daysToMaint < 0 && daysToMaint >= -GRACE_DAYS

  // Check if maintenance was done in the current cycle (past dates only)
  const currentDoneMaint = maintInCycle(maintDates, cycleStart, graceEnd)

  // Build dots
  const dots: DotState[] = Array.from({ length: totalMaint }, (_, i) => {
    const cStart = addMonths(appDate, i * 6)
    const grace  = addMonths(addMonths(appDate, (i + 1) * 6), 1)
    if (i < cycleIndex) {
      return maintInCycle(maintDates, cStart, grace) ? 'done' : 'missed'
    }
    if (i === cycleIndex) {
      if (currentDoneMaint) return 'done'
      if (inGrace)          return 'grace'
      return 'current'
    }
    return 'pending'
  })

  // If maintenance done in this cycle: reset clock from actual maintenance date
  if (currentDoneMaint) {
    const nextDue     = addMonths(currentDoneMaint, 6)
    const daysElapsed = differenceInDays(TODAY, currentDoneMaint)
    const d2m         = differenceInDays(nextDue, TODAY)
    const pct         = Math.min(Math.max((daysElapsed / MAINT_DAYS) * 100, 0), 100)
    return {
      currentMaint:    cycleIndex + 1,
      totalMaint,
      daysToMaint:     d2m,
      pct,
      gracePct:        0,
      daysGraceLeft:   0,
      nextCyclePct:    0,
      daysToNextCycle: 0,
      nextMaintDate:   format(nextDue, 'yyyy-MM-dd'),
      done:    false,
      inGrace: false,
      dots,
    }
  }

  // No maintenance done — count toward theoretical due date
  const daysElapsed    = differenceInDays(TODAY, cycleStart)
  const pct            = Math.min(Math.max((daysElapsed / MAINT_DAYS) * 100, 0), 100)
  const daysOverdue    = inGrace ? Math.abs(daysToMaint) : 0
  const daysGraceLeft  = inGrace ? GRACE_DAYS - daysOverdue : 0
  const gracePct       = inGrace ? Math.min((daysOverdue / GRACE_DAYS) * 100, 100) : 0
  // Next cycle: starts at cycleDue, due at cycleDue + 6 months
  const nextCycleDue      = addMonths(cycleDue, 6)
  const daysToNextCycle   = inGrace ? differenceInDays(nextCycleDue, TODAY) : 0
  const nextCyclePct      = inGrace ? Math.min(Math.max((daysOverdue / MAINT_DAYS) * 100, 0), 100) : 0
  return {
    currentMaint:    cycleIndex + 1,
    totalMaint,
    daysToMaint,
    pct,
    gracePct,
    daysGraceLeft,
    nextCyclePct,
    daysToNextCycle,
    nextMaintDate: format(cycleDue, 'yyyy-MM-dd'),
    done:    false,
    inGrace,
    dots,
  }
}

function getStatus(info: MaintInfo): FilterKey {
  if (info.done)                              return 'expired'
  if (info.daysToMaint === null)              return 'expired'
  if (info.daysToMaint < -GRACE_DAYS)        return 'expired'
  if (info.inGrace)                           return 'grace'
  if (info.daysToMaint <= 60)                 return 'expiring'
  return 'active'
}

function statusBadge(status: FilterKey) {
  if (status === 'expired')  return { label: 'Vencido',          variant: 'red'    as const, Icon: ShieldOff   }
  if (status === 'grace')    return { label: 'En periodo gracia', variant: 'orange' as const, Icon: Clock       }
  if (status === 'expiring') return { label: 'Por Vencer',        variant: 'orange' as const, Icon: ShieldAlert }
  return                            { label: 'Vigente',           variant: 'green'  as const, Icon: ShieldCheck }
}

// Dot visual config
const DOT_CLS: Record<DotState, string> = {
  done:    'w-2 h-2 rounded-full bg-green-500',
  missed:  'w-2 h-2 rounded-full bg-red-500',
  grace:   'w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30',
  current: 'w-2.5 h-2.5 rounded-full bg-yellow-400 ring-2 ring-yellow-400/30',
  pending: 'w-2 h-2 rounded-full bg-white/15',
}

const stagger  = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const cardAnim = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.2 } } }

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'Todos'          },
  { key: 'active',   label: 'Vigentes'       },
  { key: 'expiring', label: 'Por Vencer'     },
  { key: 'grace',    label: 'Periodo Gracia' },
  { key: 'expired',  label: 'Vencidos'       },
]

// Legend entries
const LEGEND: { state: DotState; label: string; desc: string }[] = [
  { state: 'done',    label: 'Hecho',         desc: 'Mantenimiento realizado en el ciclo' },
  { state: 'current', label: 'En curso',       desc: 'Ciclo activo, aún no vence' },
  { state: 'grace',   label: 'Periodo gracia', desc: 'Venció, tiene hasta 30 días para hacerlo' },
  { state: 'missed',  label: 'Omitido',        desc: 'El ciclo venció sin realizar mantenimiento' },
  { state: 'pending', label: 'Futuro',         desc: 'Ciclo aún no ha comenzado' },
]

type EnrichedRecord = ApiCeramicTreatment & { status: FilterKey; info: MaintInfo }

export default function Ceramicos() {
  const [filter,      setFilter]    = useState<FilterKey>('all')
  const [records,     setRecords]   = useState<ApiCeramicTreatment[]>([])
  const [loading,     setLoading]   = useState(true)
  const [selected,    setSelected]  = useState<EnrichedRecord | null>(null)
  const [showLegend,  setShowLegend] = useState(false)

  useEffect(() => {
    api.ceramics.list()
      .then(setRecords)
      .catch(err => toast.error(err.message ?? 'Error al cargar cerámicos'))
      .finally(() => setLoading(false))
  }, [])

  const enriched: EnrichedRecord[] = records.map(c => {
    const info   = getMaintenanceInfo(c.treatment_type, c.application_date, c.maintenance_dates ?? [])
    const status = getStatus(info)
    return { ...c, status, info }
  })

  const counts: Record<FilterKey, number> = {
    all:      enriched.length,
    active:   enriched.filter(c => c.status === 'active').length,
    expiring: enriched.filter(c => c.status === 'expiring').length,
    grace:    enriched.filter(c => c.status === 'grace').length,
    expired:  enriched.filter(c => c.status === 'expired').length,
  }

  const sortByUrgency = (arr: EnrichedRecord[]) =>
    [...arr].sort((a, b) => {
      const da = a.info.daysToMaint ?? Infinity
      const db = b.info.daysToMaint ?? Infinity
      return da - db
    })

  const filtered = sortByUrgency(filter === 'all' ? enriched : enriched.filter(c => c.status === filter))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Cargando cerámicos...</p>
      </div>
    )
  }

  const sel = selected
  const selSb = sel ? statusBadge(sel.status) : null

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Cerámicos"
        subtitle={`${enriched.length} tratamientos registrados`}
      />

      {/* Legend — collapsible */}
      <div className="mb-5">
        <button
          onClick={() => setShowLegend(v => !v)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronDown size={13} className={cn('transition-transform duration-200', showLegend && 'rotate-180')} />
          Sobre los puntos
        </button>
        <AnimatePresence initial={false}>
          {showLegend && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-white/[0.03] border border-white/6 px-4 py-3">
                {LEGEND.map(l => (
                  <div key={l.state} className="flex items-center gap-2">
                    <span className={DOT_CLS[l.state]} />
                    <span className="text-xs text-gray-400">
                      <span className="font-medium text-gray-300">{l.label}</span>
                      {' — '}{l.desc}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

      {/* Cards grid */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={filter}
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        >
          {filtered.length === 0 ? (
            <div className="col-span-full">
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
              const { info }  = c
              const abbrev    = TREATMENT_ABBREV[c.treatment_type] ?? c.treatment_type
              const tVariant  = TREATMENT_VARIANT[c.treatment_type] ?? 'default'
              const { dots }  = info
              const barColor  = c.status === 'expired'  ? 'bg-red-500'
                              : c.status === 'grace'    ? 'bg-amber-400'
                              : c.status === 'expiring' ? 'bg-orange-400'
                              : 'bg-green-500'
              const dotsToShow = dots.slice(0, 18)

              return (
                <motion.div key={c.id} variants={cardAnim} layout>
                  <GlassCard padding className="space-y-2.5">

                    {/* Header: vehicle icon + plate + badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="rounded-lg bg-white/8 p-1.5 shrink-0">
                          <VehicleTypeIcon
                            type={(c.vehicle?.type ?? 'automovil') as any}
                            size={16}
                            className="text-gray-300"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white tracking-wide">
                            {c.vehicle?.plate ?? '—'}
                          </p>
                          {c.vehicle?.brand && (
                            <p className="text-[11px] text-gray-500 truncate">
                              {c.vehicle.brand} {c.vehicle.model}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={tVariant} className="text-[10px] px-1.5 py-0.5">{abbrev}</Badge>
                        <button
                          onClick={() => setSelected(c)}
                          className="rounded-lg p-1 text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-colors"
                          title="Ver detalle"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Client name + phone */}
                    {c.vehicle?.client && (
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        {c.vehicle.client.name && (
                          <span className="text-[11px] text-gray-400 truncate">{c.vehicle.client.name}</span>
                        )}
                        {c.vehicle.client.phone && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(c.vehicle!.client!.phone!)
                              toast.success('Teléfono copiado')
                            }}
                            className="flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 transition-colors shrink-0"
                            title="Copiar teléfono"
                          >
                            <Phone size={10} className="shrink-0" />
                            {c.vehicle.client.phone}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Dots timeline */}
                    <div className="flex flex-wrap gap-1 items-center">
                      {dotsToShow.map((state, i) => (
                        <span key={i} className={DOT_CLS[state]} />
                      ))}
                      {dots.length > 18 && (
                        <span className="text-[10px] text-gray-600">+{dots.length - 18}</span>
                      )}
                    </div>

                    {/* Progress bars */}
                    {!info.done ? (
                      <div className="space-y-1.5">
                        {/* Cycle progress bar — hidden when in grace (replaced by next-cycle + grace bars) */}
                        {!info.inGrace && (
                          <div>
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${info.pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                                className={cn('h-full rounded-full', barColor)}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-gray-600">
                                Mant. {info.currentMaint}/{info.totalMaint}
                              </span>
                              <span className={cn(
                                'text-[10px] font-medium',
                                c.status === 'expired'  ? 'text-red-400' :
                                c.status === 'expiring' ? 'text-orange-400' : 'text-gray-500'
                              )}>
                                {info.daysToMaint !== null
                                  ? info.daysToMaint === 0 ? 'Hoy'
                                  : `${info.daysToMaint}d`
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                        {/* Grace: two bars swapped — green next cycle, amber grace */}
                        {info.inGrace && (
                          <>
                            {/* Bar 1 (shown instead of cycle bar): green, next maintenance */}
                            <div>
                              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${info.nextCyclePct}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                                  className="h-full rounded-full bg-green-500"
                                />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] text-gray-600">Próx. mant.</span>
                                <span className="text-[10px] font-medium text-green-400">
                                  {info.daysToNextCycle}d
                                </span>
                              </div>
                            </div>
                            {/* Bar 2: amber, grace period */}
                            <div>
                              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${info.gracePct}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                                  className="h-full rounded-full bg-amber-400"
                                />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] text-gray-600">Gracia</span>
                                <span className="text-[10px] font-medium text-amber-400">
                                  {info.daysGraceLeft}d restantes
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-600">
                        Ciclo {TREATMENT_YEARS[c.treatment_type] ?? '?'} años completado
                      </p>
                    )}

                  </GlassCard>
                </motion.div>
              )
            })
          )}
        </motion.div>
      </AnimatePresence>

      {/* Detail modal */}
      {sel && selSb && (
        <Modal open={!!sel} onClose={() => setSelected(null)} title="Detalle del tratamiento" size="lg">
          <div className="p-6 space-y-4">

            {/* Vehicle + treatment */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/8 p-2.5">
                  <VehicleTypeIcon
                    type={(sel.vehicle?.type ?? 'automovil') as any}
                    size={22}
                    className="text-gray-300"
                  />
                </div>
                <div>
                  <p className="text-base font-bold text-white">
                    {sel.vehicle?.brand} {sel.vehicle?.model}
                  </p>
                  <p className="text-sm text-gray-400">
                    {sel.vehicle?.plate}{sel.vehicle?.color ? ` · ${sel.vehicle.color}` : ''}
                  </p>
                </div>
              </div>
              <Badge variant={TREATMENT_VARIANT[sel.treatment_type] ?? 'default'}>
                {TREATMENT_ABBREV[sel.treatment_type] ?? sel.treatment_type}
              </Badge>
            </div>

            {/* Status banner — full color block */}
            <div className={cn(
              'flex items-center gap-2.5 rounded-xl px-4 py-3',
              sel.status === 'active'   ? 'bg-green-500/15 border border-green-500/25' :
              sel.status === 'expiring' ? 'bg-orange-500/15 border border-orange-500/25' :
              sel.status === 'grace'    ? 'bg-amber-400/15 border border-amber-400/25' :
                                         'bg-red-500/15 border border-red-500/25'
            )}>
              <selSb.Icon size={16} className={cn(
                sel.status === 'active'   ? 'text-green-400'  :
                sel.status === 'expiring' ? 'text-orange-400' :
                sel.status === 'grace'    ? 'text-amber-400'  : 'text-red-400'
              )} />
              <span className={cn(
                'text-sm font-semibold',
                sel.status === 'active'   ? 'text-green-300'  :
                sel.status === 'expiring' ? 'text-orange-300' :
                sel.status === 'grace'    ? 'text-amber-300'  : 'text-red-300'
              )}>
                {selSb.label}
              </span>
              {sel.info.daysToMaint !== null && (
                <span className={cn(
                  'text-sm ml-auto',
                  sel.status === 'active'   ? 'text-green-400/70'  :
                  sel.status === 'expiring' ? 'text-orange-400/70' :
                  sel.status === 'grace'    ? 'text-amber-400/70'  : 'text-red-400/70'
                )}>
                  {sel.info.daysToMaint < 0
                    ? `${Math.abs(sel.info.daysToMaint)}d tarde`
                    : sel.info.daysToMaint === 0 ? 'Vence hoy'
                    : `${sel.info.daysToMaint}d restantes`}
                </span>
              )}
            </div>

            {/* Client */}
            {sel.vehicle?.client && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={13} className="text-gray-600 shrink-0" />
                  <span className="text-sm text-gray-300 truncate">{sel.vehicle.client.name}</span>
                </div>
                {sel.vehicle.client.phone && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sel.vehicle!.client!.phone!)
                      toast.success('Teléfono copiado')
                    }}
                    className="flex items-center gap-1.5 text-sm text-yellow-400 hover:text-yellow-300 transition-colors shrink-0"
                    title="Copiar teléfono"
                  >
                    <Phone size={12} />
                    {sel.vehicle.client.phone}
                  </button>
                )}
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2.5">
                <p className="text-xs text-gray-600 mb-0.5">Aplicado</p>
                <p className="text-gray-200 font-medium">
                  {format(parseISO(sel.application_date), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2.5">
                <p className="text-xs text-gray-600 mb-0.5">Operario</p>
                <p className="text-gray-200 font-medium">{sel.operator?.name ?? '—'}</p>
              </div>
              <div className="col-span-2 rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2.5">
                <p className="text-xs text-gray-600 mb-0.5">Próximo mantenimiento</p>
                <p className="text-gray-200 font-medium">
                  {sel.info.nextMaintDate
                    ? format(parseISO(sel.info.nextMaintDate), "d MMM yyyy", { locale: es })
                    : sel.info.done ? 'Ciclo completado' : '—'}
                </p>
              </div>
            </div>

            {/* Full dot timeline */}
            <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">
                  Historial de mantenimientos — {sel.info.currentMaint} de {sel.info.totalMaint}
                </p>
                <p className="text-xs text-gray-600">
                  {TREATMENT_YEARS[sel.treatment_type] ?? '?'} años · {sel.info.totalMaint} ciclos
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {sel.info.dots.map((state, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className={DOT_CLS[state]} />
                    <span className="text-[9px] text-gray-700">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bars */}
            {!sel.info.done && (
              <div className="space-y-3">
                {/* Cycle bar — hidden when in grace */}
                {!sel.info.inGrace && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Progreso ciclo actual</span>
                      <span className={cn(
                        sel.status === 'expiring' ? 'text-orange-400' :
                        sel.status === 'expired'  ? 'text-red-400' : ''
                      )}>
                        {sel.info.daysToMaint !== null
                          ? sel.info.daysToMaint === 0 ? 'Vence hoy'
                          : `${sel.info.daysToMaint}d restantes`
                          : '—'}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${sel.info.pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn('h-full rounded-full',
                          sel.status === 'expired'  ? 'bg-red-500'   :
                          sel.status === 'expiring' ? 'bg-orange-400': 'bg-green-500'
                        )}
                      />
                    </div>
                  </div>
                )}
                {/* Grace: two extra bars */}
                {sel.info.inGrace && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Próximo mantenimiento</span>
                        <span className="text-green-400">{sel.info.daysToNextCycle}d restantes</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${sel.info.nextCyclePct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                          className="h-full rounded-full bg-green-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Periodo de gracia</span>
                        <span className="text-amber-400">{sel.info.daysGraceLeft}d restantes</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${sel.info.gracePct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.25 }}
                          className="h-full rounded-full bg-amber-400"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Wrench icon note */}
            <div className="flex items-start gap-2 rounded-xl bg-white/[0.02] border border-white/6 px-3 py-2.5">
              <Wrench size={13} className="text-gray-600 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500">
                El mantenimiento se registra automáticamente cuando se entrega una orden de{' '}
                <span className="text-gray-300 font-medium">Mantenimiento Cerámico</span>{' '}
                para este vehículo.
              </p>
            </div>

          </div>
        </Modal>
      )}
    </div>
  )
}
