import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Lock, ChevronLeft, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Info,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiLiqWeekResponse, type ApiDebt } from '@/api'
import type { Operator } from '@/types'
import {
  OP_COLORS, OP_TYPE_STYLE, getInitials, cop, getWeekStart,
  PATIO_STATUS_LABEL,
} from './liquidacion/helpers'

// ── Cédula modal ─────────────────────────────────────────────────────────────

function CedulaModal({
  operator,
  onClose,
  onSuccess,
}: {
  operator: Operator
  onClose: () => void
  onSuccess: () => void
}) {
  const [cedula, setCedula] = useState('')
  const [shake,  setShake]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  const color  = OP_COLORS[0]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const stored = operator.cedula?.trim() ?? ''
    if (stored && cedula.trim() === stored) {
      onSuccess()
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setCedula('')
      toast.error('Cédula incorrecta')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className={cn('rounded-2xl p-4 text-2xl font-bold', color.bg, color.text)}>
              {getInitials(operator.name)}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white">{operator.name}</h2>
              <p className="text-sm text-gray-500 mt-1">Ingresa tu número de cédula</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <motion.input
              ref={inputRef}
              animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
              type="tel"
              inputMode="numeric"
              value={cedula}
              onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 10234567890"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg text-gray-100 placeholder:text-gray-600 tracking-widest focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
            />
            <button
              type="submit"
              disabled={!cedula}
              className="w-full rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-gray-950 hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ver mi liquidación
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

// ── Week summary (read-only) ──────────────────────────────────────────────────

function WeekSummary({
  operator,
  weekData,
  debts,
  onBack,
}: {
  operator: Operator
  weekData: ApiLiqWeekResponse
  debts: ApiDebt[]
  onBack: () => void
}) {
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())
  const opIdx   = 0
  const color   = OP_COLORS[0]
  const typeStyle = OP_TYPE_STYLE[operator.operator_type ?? 'detallado']

  const weekStart = parseISO(weekData.week_start)
  const weekEnd   = parseISO(weekData.week_end)

  const pendingDebts = debts.filter(d => d.direction === 'operario_empresa' && !d.paid)
  const pendingDebtTotal = pendingDebts.reduce((s, d) => s + Number(d.amount) - Number(d.paid_amount), 0)

  const estimatedNet = Math.max(0, Number(weekData.commission_amount) - pendingDebtTotal)

  function toggleDay(date: string) {
    setOpenDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
      >
        <ChevronLeft size={16} /> Operarios
      </button>

      {/* Header card */}
      <GlassCard padding className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-2xl p-3 text-xl font-bold leading-none min-w-[48px] text-center shrink-0', color.bg, color.text)}>
            {getInitials(operator.name)}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{operator.name}</h2>
            {typeStyle && (
              <span className={cn('inline-block text-xs px-2 py-0.5 rounded-full border mt-0.5', typeStyle.cls)}>
                {typeStyle.label}
              </span>
            )}
          </div>
        </div>

        {/* Week range */}
        <div className="text-sm text-gray-400">
          Semana{' '}
          <span className="text-gray-200 font-medium">
            {format(weekStart, "d 'de' MMMM", { locale: es })}
          </span>
          {' – '}
          <span className="text-gray-200 font-medium">
            {format(weekEnd, "d 'de' MMMM", { locale: es })}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl bg-white/4 px-3 py-2.5 text-center">
            <div className="text-xs text-gray-500 mb-1">Servicios</div>
            <div className="text-lg font-bold text-white">{weekData.week_services}</div>
          </div>
          <div className="rounded-xl bg-white/4 px-3 py-2.5 text-center">
            <div className="text-xs text-gray-500 mb-1">
              {operator.operator_type === 'pintura' ? 'Piezas' : 'Base'}
            </div>
            <div className="text-sm font-bold text-white">
              {operator.operator_type === 'pintura'
                ? weekData.piece_count ?? '0'
                : `$${cop(weekData.commission_base)}`
              }
            </div>
          </div>
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5 text-center">
            <div className="text-xs text-yellow-500/70 mb-1">Comisión</div>
            <div className="text-sm font-bold text-yellow-400">${cop(weekData.commission_amount)}</div>
          </div>
        </div>

        {/* Ceramic bonus */}
        {Number(weekData.ceramic_bonus_total ?? 0) > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-sm">
            <span className="text-purple-300">Bonos cerámico</span>
            <span className="font-medium text-purple-300">+${cop(weekData.ceramic_bonus_total!)}</span>
          </div>
        )}

        {/* Pending debts */}
        {pendingDebtTotal > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm">
            <span className="text-red-400 flex items-center gap-1.5">
              <AlertCircle size={14} /> Deuda pendiente
            </span>
            <span className="font-medium text-red-400">-${cop(pendingDebtTotal)}</span>
          </div>
        )}

        {/* Estimated net */}
        {pendingDebtTotal > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2.5 text-sm">
            <span className="text-green-400 font-medium">Estimado neto</span>
            <span className="text-lg font-bold text-green-400">${cop(estimatedNet)}</span>
          </div>
        )}

        {/* Liquidated badge */}
        {weekData.is_liquidated && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Esta semana ya fue liquidada</span>
            {weekData.net_amount && (
              <span className="ml-auto font-semibold">${cop(weekData.net_amount)}</span>
            )}
          </div>
        )}

        {/* Disclaimer */}
        {!weekData.is_liquidated && (
          <div className="flex items-start gap-2 rounded-xl bg-white/3 px-3 py-2 text-xs text-gray-500">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>Este es un estimado. La liquidación final la confirma la administración al finalizar la semana.</span>
          </div>
        )}
      </GlassCard>

      {/* Days breakdown */}
      <div className="space-y-2">
        {weekData.days.filter(d => d.orders.length > 0).map(day => (
          <GlassCard key={day.date} padding={false} className="overflow-hidden">
            <button
              onClick={() => toggleDay(day.date)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-gray-200 capitalize">
                  {day.day_name}
                  <span className="text-gray-500 ml-2 text-xs font-normal">
                    {format(parseISO(day.date), 'd MMM', { locale: es })}
                  </span>
                </div>
                <span className="text-xs bg-white/6 text-gray-400 rounded-full px-2 py-0.5">
                  {day.orders.length} orden{day.orders.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-yellow-400">${cop(day.day_total)}</span>
                {openDays.has(day.date)
                  ? <ChevronUp size={16} className="text-gray-500" />
                  : <ChevronDown size={16} className="text-gray-500" />
                }
              </div>
            </button>

            <AnimatePresence>
              {openDays.has(day.date) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-white/6"
                >
                  <div className="divide-y divide-white/4">
                    {day.orders.map(order => (
                      <div key={order.order_id} className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-gray-300 font-medium">
                            {order.vehicle_brand} {order.vehicle_model}
                            <span className="ml-1.5 text-xs text-gray-500 font-mono">{order.vehicle_plate}</span>
                          </div>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full border',
                            order.is_liquidated
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-gray-400 border-white/10 bg-white/4',
                          )}>
                            {order.is_liquidated ? 'Liquidado' : (PATIO_STATUS_LABEL[order.patio_status] ?? order.patio_status)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-gray-400">
                              <span>{item.service_name}</span>
                              <span>${cop(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-white/6">
                          <span className="text-gray-500">Base</span>
                          <span className="text-gray-200 font-medium">${cop(order.commission_base ?? order.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        ))}

        {weekData.days.every(d => d.orders.length === 0) && (
          <div className="text-center py-10 text-gray-600 text-sm">
            Sin órdenes esta semana
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MiLiquidacionPage() {
  const [operators,     setOperators]     = useState<Operator[]>([])
  const [opsLoading,    setOpsLoading]    = useState(true)
  const [selectedOp,    setSelectedOp]    = useState<Operator | null>(null)
  const [modalOp,       setModalOp]       = useState<Operator | null>(null)
  const [weekData,      setWeekData]      = useState<ApiLiqWeekResponse | null>(null)
  const [debts,         setDebts]         = useState<ApiDebt[]>([])
  const [weekLoading,   setWeekLoading]   = useState(false)

  useEffect(() => {
    api.operators.list(false)
      .then(ops => setOperators(ops.filter(o => o.active)))
      .catch(() => toast.error('Error al cargar operarios'))
      .finally(() => setOpsLoading(false))
  }, [])

  async function handleCedulaSuccess() {
    if (!modalOp) return
    setModalOp(null)
    setWeekLoading(true)
    setWeekData(null)
    setDebts([])
    setSelectedOp(modalOp)
    try {
      const ws = format(getWeekStart(0), 'yyyy-MM-dd')
      const [week, opDebts] = await Promise.all([
        api.liquidation.getWeek(modalOp.id, ws),
        api.liquidation.listDebts(modalOp.id),
      ])
      setWeekData(week)
      setDebts(opDebts)
    } catch {
      toast.error('Error al cargar liquidación')
      setSelectedOp(null)
    } finally {
      setWeekLoading(false)
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selectedOp && weekData) {
    return (
      <WeekSummary
        operator={selectedOp}
        weekData={weekData}
        debts={debts}
        onBack={() => { setSelectedOp(null); setWeekData(null); setDebts([]) }}
      />
    )
  }

  if (selectedOp && weekLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500 text-sm">Cargando liquidación...</div>
      </div>
    )
  }

  // ── Operator grid ─────────────────────────────────────────────────────────
  const grouped = operators.reduce<Record<string, Operator[]>>((acc, op) => {
    const t = op.operator_type ?? 'detallado'
    if (!acc[t]) acc[t] = []
    acc[t].push(op)
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cédula modal */}
      <AnimatePresence>
        {modalOp && (
          <CedulaModal
            operator={modalOp}
            onClose={() => setModalOp(null)}
            onSuccess={handleCedulaSuccess}
          />
        )}
      </AnimatePresence>

      <PageHeader
        title="Mi Liquidación"
        subtitle="Selecciona tu nombre e ingresa tu cédula para ver tu estimado semanal"
      />

      <GlassCard padding className="flex items-start gap-3 text-sm text-gray-400">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-yellow-500" />
        <span>
          Solo tú puedes ver tu liquidación. Tu cédula actúa como contraseña — no se comparte con nadie.
        </span>
      </GlassCard>

      {opsLoading ? (
        <div className="text-center py-10 text-gray-500 text-sm">Cargando operarios...</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, ops]) => {
            const style = OP_TYPE_STYLE[type]
            return (
              <div key={type} className="space-y-2">
                {style && (
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn('text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border', style.cls)}>
                      {style.label}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ops.map((op, i) => {
                    const color = OP_COLORS[i % OP_COLORS.length]
                    return (
                      <motion.button
                        key={op.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (!op.cedula) {
                            toast.error('Este operario no tiene cédula registrada')
                            return
                          }
                          setModalOp(op)
                        }}
                        className="flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/12 p-5 transition-all text-center"
                      >
                        <div className={cn('rounded-2xl p-3 text-xl font-bold leading-none min-w-[52px]', color.bg, color.text)}>
                          {getInitials(op.name)}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-200 leading-tight">{op.name}</div>
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                            <Lock size={10} />
                            <span>Cédula requerida</span>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
