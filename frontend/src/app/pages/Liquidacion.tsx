import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, ChevronLeft, ChevronRight, ChevronDown,
  Plus, Check, X, TrendingUp, TrendingDown, Download, Banknote,
  Phone, CreditCard,
} from 'lucide-react'
import { format, startOfWeek, addWeeks, addDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiLiqWeekResponse, type ApiDebt, type LiquidatePayload } from '@/api'
import type { Operator } from '@/types'

const CORRECT_PASSWORD = 'BDCP123'

const OP_COLORS = [
  { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  { bg: 'bg-green-500/20',  text: 'text-green-400'  },
  { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  { bg: 'bg-pink-500/20',   text: 'text-pink-400'   },
  { bg: 'bg-cyan-500/20',   text: 'text-cyan-400'   },
]

const PATIO_STATUS_LABEL: Record<string, string> = {
  esperando:  'Esperando',
  en_proceso: 'En proceso',
  listo:      'Listo',
  entregado:  'Entregado',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getWeekStart(offset: number): Date {
  return addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), offset)
}

function cop(n: string | number) {
  return Number(n).toLocaleString('es-CO')
}

// ── Liquidar Modal ────────────────────────────────────────────────────────────

interface LiquidarModalProps {
  open: boolean
  onClose: () => void
  operator: Operator
  weekData: ApiLiqWeekResponse
  debts: ApiDebt[]
  onConfirm: (payload: LiquidatePayload) => Promise<void>
}

function LiquidarModal({ open, onClose, operator, weekData, debts, onConfirm }: LiquidarModalProps) {
  const commission = Number(weekData.commission_amount)

  const unpaidOpOwes      = debts.filter(d => d.direction === 'operario_empresa' && !d.paid)
  const unpaidCompanyOwes = debts.filter(d => d.direction === 'empresa_operario' && !d.paid)

  const [abonoInputs,    setAbonoInputs]    = useState<Record<number, string>>({})
  const [settleInputs,   setSettleInputs]   = useState<Record<number, { include: boolean; amount: string }>>({})
  const [payTransfer,    setPayTransfer]    = useState('')
  const [payCash,        setPayCash]        = useState('')
  const [submitting,     setSubmitting]     = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (!open) return
    const ai: Record<number, string> = {}
    unpaidOpOwes.forEach(d => { ai[d.id] = '' })
    setAbonoInputs(ai)

    const si: Record<number, { include: boolean; amount: string }> = {}
    unpaidCompanyOwes.forEach(d => {
      si[d.id] = { include: false, amount: String(Number(d.amount) - Number(d.paid_amount)) }
    })
    setSettleInputs(si)
    setPayTransfer('')
    setPayCash('')
  }, [open])

  const totalAbonos    = unpaidOpOwes.reduce((s, d) => s + (Number(abonoInputs[d.id]) || 0), 0)
  const totalSettled   = unpaidCompanyOwes.reduce((s, d) =>
    s + (settleInputs[d.id]?.include ? (Number(settleInputs[d.id]?.amount) || 0) : 0), 0)
  const netAmount      = commission - totalAbonos + totalSettled
  const totalPaid      = (Number(payTransfer) || 0) + (Number(payCash) || 0)
  const pending        = Math.max(0, netAmount - totalPaid)

  async function handleConfirm() {
    setSubmitting(true)
    const payload: LiquidatePayload = {
      abonos: unpaidOpOwes
        .filter(d => Number(abonoInputs[d.id]) > 0)
        .map(d => ({ debt_id: d.id, amount: Number(abonoInputs[d.id]) })),
      company_settlements: unpaidCompanyOwes
        .filter(d => settleInputs[d.id]?.include && Number(settleInputs[d.id]?.amount) > 0)
        .map(d => ({ debt_id: d.id, amount: Number(settleInputs[d.id].amount) })),
      payment_transfer: Number(payTransfer) || 0,
      payment_cash:     Number(payCash)     || 0,
    }
    try {
      await onConfirm(payload)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 20,  scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gray-900 shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gray-900 z-10">
              <div>
                <h2 className="text-base font-semibold text-white">Liquidar semana</h2>
                <p className="text-xs text-gray-500">
                  {format(parseISO(weekData.week_start), "d MMM", { locale: es })} – {format(parseISO(weekData.week_end), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Comisión */}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Comisión de la semana</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{weekData.week_services} servicios · Total bruto</span>
                  <span className="text-gray-200">${cop(weekData.week_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Comisión ({Number(weekData.commission_rate)}%)</span>
                  <span className="text-yellow-400 font-semibold">${cop(weekData.commission_amount)}</span>
                </div>
              </div>

              {/* Abonos operario→empresa */}
              {unpaidOpOwes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-red-400" />
                    Deudas del operario con la empresa
                  </p>
                  {unpaidOpOwes.map(debt => {
                    const remaining = Number(debt.amount) - Number(debt.paid_amount)
                    return (
                      <div key={debt.id} className="rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">{debt.description || 'Sin descripción'}</span>
                          <span className="text-red-400 font-medium">Pendiente: ${cop(remaining)}</span>
                        </div>
                        {/* Abono history */}
                        {debt.payments && debt.payments.length > 0 && (
                          <div className="space-y-0.5">
                            {debt.payments.map(p => (
                              <p key={p.id} className="text-[11px] text-gray-600">
                                Abono ${cop(p.amount)} · {format(parseISO(p.created_at), "d MMM yyyy", { locale: es })}
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 shrink-0">Abono ahora:</span>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            placeholder="0"
                            value={abonoInputs[debt.id] ?? ''}
                            onChange={e => setAbonoInputs(p => ({ ...p, [debt.id]: e.target.value }))}
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-red-500/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Company→operator debts to settle */}
              {unpaidCompanyOwes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown size={12} className="text-green-400" />
                    Deudas de la empresa con el operario
                  </p>
                  {unpaidCompanyOwes.map(debt => {
                    const remaining = Number(debt.amount) - Number(debt.paid_amount)
                    const state = settleInputs[debt.id]
                    return (
                      <div key={debt.id} className={cn(
                        'rounded-xl border px-4 py-3 space-y-2 transition-colors',
                        state?.include ? 'border-green-500/25 bg-green-500/8' : 'border-white/8 bg-white/[0.02]'
                      )}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-300">{debt.description || 'Sin descripción'}</span>
                          <button
                            onClick={() => setSettleInputs(p => ({
                              ...p,
                              [debt.id]: { ...p[debt.id], include: !p[debt.id]?.include }
                            }))}
                            className={cn(
                              'shrink-0 rounded-lg px-2.5 py-1 text-xs transition-colors',
                              state?.include
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-white/8 text-gray-400 hover:bg-white/12'
                            )}
                          >
                            {state?.include ? <><Check size={11} className="inline mr-1" />Incluir</> : 'Incluir en pago'}
                          </button>
                        </div>
                        {state?.include && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">Monto (máx ${cop(remaining)}):</span>
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              value={state.amount}
                              onChange={e => setSettleInputs(p => ({ ...p, [debt.id]: { ...p[debt.id], amount: e.target.value } }))}
                              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-green-500/50 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Resumen */}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Resumen del pago</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Comisión</span>
                    <span className="text-gray-200">+${cop(commission)}</span>
                  </div>
                  {totalAbonos > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Abonos del operario</span>
                      <span className="text-red-400">−${cop(totalAbonos)}</span>
                    </div>
                  )}
                  {totalSettled > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Deudas empresa incluidas</span>
                      <span className="text-green-400">+${cop(totalSettled)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/8 pt-2 font-semibold">
                    <span className="text-gray-300">Total a pagar</span>
                    <span className="text-yellow-400 text-base">${cop(netAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Método de pago */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Método de pago</p>

                {/* Quick-fill buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPayTransfer(String(netAmount > 0 ? netAmount : 0)); setPayCash('0') }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:border-yellow-500/40 hover:text-yellow-300 transition-colors"
                  >
                    <CreditCard size={13} />
                    Todo transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPayCash(String(netAmount > 0 ? netAmount : 0)); setPayTransfer('0') }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:border-yellow-500/40 hover:text-yellow-300 transition-colors"
                  >
                    <Banknote size={13} />
                    Todo efectivo
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Transferencia</label>
                    <input
                      type="number" min={0} max={netAmount} placeholder="0"
                      value={payTransfer}
                      onChange={e => {
                        const val = Math.min(Math.max(0, Number(e.target.value)), netAmount)
                        setPayTransfer(String(val))
                        setPayCash(String(Math.max(0, netAmount - val)))
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Efectivo</label>
                    <input
                      type="number" min={0} max={netAmount} placeholder="0"
                      value={payCash}
                      onChange={e => {
                        const val = Math.min(Math.max(0, Number(e.target.value)), netAmount)
                        setPayCash(String(val))
                        setPayTransfer(String(Math.max(0, netAmount - val)))
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Total pagado</span>
                    <span className={cn(totalPaid >= netAmount ? 'text-green-400' : 'text-gray-200')}>${cop(totalPaid)}</span>
                  </div>
                  {pending > 0 && (
                    <div className="flex justify-between text-orange-400">
                      <span className="flex items-center gap-1">
                        <TrendingDown size={12} />
                        Pendiente → deuda empresa
                      </span>
                      <span className="font-semibold">${cop(pending)}</span>
                    </div>
                  )}
                  {pending === 0 && totalPaid > 0 && (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <Check size={12} />
                      <span>Pago completo</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 px-5 py-4 border-t border-white/8 bg-gray-900">
              <Button
                variant="primary" size="md" className="w-full"
                onClick={handleConfirm}
                disabled={submitting}
              >
                <Banknote size={16} />
                {submitting ? 'Procesando...' : 'Confirmar liquidación'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LiquidacionPage() {
  const [unlocked,    setUnlocked]    = useState(false)
  const [pwd,         setPwd]         = useState('')
  const [shake,       setShake]       = useState(false)
  const [operators,   setOperators]   = useState<Operator[]>([])
  const [opsLoading,  setOpsLoading]  = useState(true)
  const [selectedOp,  setSelectedOp]  = useState<number | null>(null)
  const [weekOffset,  setWeekOffset]  = useState(0)
  const [weekData,    setWeekData]    = useState<ApiLiqWeekResponse | null>(null)
  const [weekLoading, setWeekLoading] = useState(false)
  const [debts,       setDebts]       = useState<ApiDebt[]>([])
  const [openDays,    setOpenDays]    = useState<Set<string>>(new Set())
  const [addDebtOpen, setAddDebtOpen] = useState(false)
  const [liquidarOpen, setLiquidarOpen] = useState(false)
  const [debtForm, setDebtForm] = useState({
    direction: 'empresa_operario' as 'empresa_operario' | 'operario_empresa',
    amount: '',
    description: '',
  })

  useEffect(() => {
    if (!unlocked) return
    api.operators.list()
      .then(ops => setOperators(ops.filter((o: Operator) => o.active)))
      .catch(() => toast.error('Error al cargar operarios'))
      .finally(() => setOpsLoading(false))
  }, [unlocked])

  useEffect(() => {
    if (selectedOp === null) return
    const ws = format(getWeekStart(weekOffset), 'yyyy-MM-dd')
    setWeekLoading(true)
    setWeekData(null)
    api.liquidation.getWeek(selectedOp, ws)
      .then(setWeekData)
      .catch(() => toast.error('Error al cargar datos de semana'))
      .finally(() => setWeekLoading(false))
  }, [selectedOp, weekOffset])

  useEffect(() => {
    if (selectedOp === null) return
    api.liquidation.listDebts(selectedOp)
      .then(setDebts)
      .catch(() => {})
  }, [selectedOp])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pwd === CORRECT_PASSWORD) {
      setUnlocked(true)
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      toast.error('Contraseña incorrecta')
      setPwd('')
    }
  }

  function toggleDay(dateStr: string) {
    setOpenDays(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  async function handleAddDebt() {
    if (!selectedOp || !debtForm.amount) return
    try {
      const debt = await api.liquidation.createDebt(selectedOp, {
        direction: debtForm.direction,
        amount: Number(debtForm.amount),
        description: debtForm.description || undefined,
      })
      setDebts(prev => [debt, ...prev])
      setDebtForm({ direction: 'empresa_operario', amount: '', description: '' })
      setAddDebtOpen(false)
      toast.success('Deuda registrada')
    } catch {
      toast.error('Error al registrar deuda')
    }
  }

  async function handleMarkPaid(debtId: number) {
    try {
      const updated = await api.liquidation.markDebtPaid(debtId)
      setDebts(prev => prev.map(d => d.id === debtId ? updated : d))
      toast.success('Marcada como pagada')
    } catch {
      toast.error('Error al actualizar deuda')
    }
  }

  async function handleLiquidate(payload: LiquidatePayload) {
    if (!selectedOp || !weekData) return
    const updated = await api.liquidation.liquidate(selectedOp, weekData.week_start, payload)
    setWeekData(updated)
    // Refresh debts as they may have changed
    const updatedDebts = await api.liquidation.listDebts(selectedOp)
    setDebts(updatedDebts)
    toast.success('Semana liquidada correctamente')
  }

  // ── Lock screen ─────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <GlassCard padding className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-yellow-500/10 p-4">
                <Lock size={36} className="text-yellow-400" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white">Acceso Restringido</h2>
                <p className="text-sm text-gray-500 mt-1">Ingresa la contraseña para ver la liquidación</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <motion.div
                animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                <input
                  type="password"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg text-gray-100 placeholder:text-gray-600 tracking-widest focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
                />
              </motion.div>
              <Button type="submit" variant="primary" size="lg" className="w-full">
                Ingresar
              </Button>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    )
  }

  // ── Operator detail ──────────────────────────────────────────────────────────
  if (selectedOp !== null) {
    const operator  = operators.find(o => o.id === selectedOp)
    const opIdx     = operator ? operators.indexOf(operator) : 0
    const opColor   = OP_COLORS[opIdx % OP_COLORS.length]
    const weekStart = getWeekStart(weekOffset)
    const weekEnd   = addDays(weekStart, 6)

    const unpaidCompanyOwes  = debts.filter(d => d.direction === 'empresa_operario' && !d.paid)
    const unpaidOperatorOwes = debts.filter(d => d.direction === 'operario_empresa' && !d.paid)
    const paidDebts          = debts.filter(d => d.paid)

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Liquidar modal */}
        {operator && weekData && (
          <LiquidarModal
            open={liquidarOpen}
            onClose={() => setLiquidarOpen(false)}
            operator={operator}
            weekData={weekData}
            debts={debts}
            onConfirm={handleLiquidate}
          />
        )}

        {/* Back */}
        <button
          onClick={() => { setSelectedOp(null); setWeekData(null); setWeekOffset(0); setDebts([]) }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <ChevronLeft size={16} /> Operarios
        </button>

        {/* Operator header */}
        {operator && (
          <GlassCard padding>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn('rounded-2xl p-3 text-lg sm:text-2xl font-bold leading-none min-w-[48px] sm:min-w-[56px] text-center shrink-0', opColor.bg, opColor.text)}>
                  {getInitials(operator.name)}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h2 className="text-base sm:text-xl font-semibold text-white leading-snug">{operator.name}</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Comisión {Number(operator.commission_rate)}%</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={10} />
                      {operator.phone || '—'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <CreditCard size={10} />
                      {(operator as any).cedula || '—'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 sm:px-3 sm:py-2 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors shrink-0"
              >
                <Download size={15} />
                <span className="hidden sm:inline text-sm">Descargar</span>
              </button>
            </div>
          </GlassCard>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="rounded-xl bg-white/5 p-2.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-gray-200">
              {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {weekOffset === 0 ? 'Semana actual' : weekOffset === -1 ? 'Semana pasada' : weekOffset < 0 ? `Hace ${Math.abs(weekOffset)} semanas` : `En ${weekOffset} semanas`}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            disabled={weekOffset >= 0}
            className="rounded-xl bg-white/5 p-2.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Week summary */}
        {weekData && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Servicios', value: weekData.week_services },
                { label: 'Total', value: `$${cop(weekData.week_total)}` },
                { label: `Com. ${Number(weekData.commission_rate)}%`, value: `$${cop(weekData.commission_amount)}`, highlight: true },
              ].map(item => (
                <GlassCard key={item.label} padding className="text-center !px-2 !py-3">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-1 leading-tight">{item.label}</p>
                  <p className={cn('text-sm sm:text-lg font-bold truncate', item.highlight ? 'text-yellow-400' : 'text-white')}>
                    {item.value}
                  </p>
                </GlassCard>
              ))}
            </div>

            {weekData.is_liquidated ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-green-500/25 bg-green-500/8 py-3">
                  <Check size={15} className="text-green-400" />
                  <span className="text-sm text-green-400 font-medium">
                    Semana liquidada
                    {weekData.liquidated_at && (
                      <span className="text-green-600 font-normal ml-2">
                        · {format(new Date(weekData.liquidated_at), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                  </span>
                </div>
                {/* Payment breakdown when liquidated */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {weekData.net_amount && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Neto pagado</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.net_amount)}</p>
                    </div>
                  )}
                  {Number(weekData.payment_transfer_amount) > 0 && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Transferencia</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.payment_transfer_amount!)}</p>
                    </div>
                  )}
                  {Number(weekData.payment_cash_amount) > 0 && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Efectivo</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.payment_cash_amount!)}</p>
                    </div>
                  )}
                  {Number(weekData.amount_pending) > 0 && (
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-center">
                      <p className="text-orange-600">Pendiente</p>
                      <p className="text-orange-400 font-semibold">${cop(weekData.amount_pending!)}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Button
                variant="primary" size="md" className="w-full"
                onClick={() => setLiquidarOpen(true)}
                disabled={weekData.week_services === 0}
              >
                <Banknote size={16} />
                Liquidar semana
              </Button>
            )}
          </>
        )}

        {/* Daily accordion */}
        <div className="space-y-2">
          {weekLoading && (
            <div className="flex justify-center py-8">
              <p className="text-sm text-gray-500">Cargando semana...</p>
            </div>
          )}
          {weekData && weekData.days.map(day => {
            const isOpen    = openDays.has(day.date)
            const hasOrders = day.day_services > 0
            const dayDate   = parseISO(day.date)

            return (
              <div key={day.date} className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => hasOrders && toggleDay(day.date)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                    hasOrders ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[36px]">
                      <p className="text-xs text-gray-500">{day.day_name.slice(0, 3)}</p>
                      <p className="text-base font-semibold text-white">{format(dayDate, 'd')}</p>
                    </div>
                    <div>
                      {hasOrders ? (
                        <>
                          <p className="text-sm text-gray-200 font-medium">{day.day_services} servicio{day.day_services !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-gray-400">
                            ${cop(day.day_total)}
                            <span className="text-yellow-500 ml-2">
                              · comisión ${cop((Number(day.day_total) * Number(weekData.commission_rate) / 100).toFixed(0))}
                            </span>
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">Sin servicios</p>
                      )}
                    </div>
                  </div>
                  {hasOrders && (
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={16} className="text-gray-500" />
                    </motion.div>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && hasOrders && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-2 border-t border-white/6">
                        {day.orders.map(order => (
                          <div key={order.order_id} className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-mono text-gray-400">{order.order_number}</span>
                                  <span className="text-sm text-gray-200">{order.vehicle_brand} {order.vehicle_model}</span>
                                  <span className="text-xs text-gray-500">{order.vehicle_plate}</span>
                                  <Badge variant={order.patio_status === 'entregado' ? 'green' : order.patio_status === 'listo' ? 'blue' : 'orange'} className="text-[10px]">
                                    {PATIO_STATUS_LABEL[order.patio_status] ?? order.patio_status}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-x-1.5 mt-1">
                                  {order.items.map((item, i) => (
                                    <span key={i} className="text-xs text-gray-600">{item.service_name}{i < order.items.length - 1 ? ' ·' : ''}</span>
                                  ))}
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-yellow-400 shrink-0">${cop(order.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Debts section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Deudas</h3>
            <button
              onClick={() => setAddDebtOpen(true)}
              className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              <Plus size={14} /> Registrar deuda
            </button>
          </div>

          <AnimatePresence>
            {addDebtOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <GlassCard padding className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-200">Nueva deuda</p>
                    <button onClick={() => setAddDebtOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDebtForm(f => ({ ...f, direction: 'empresa_operario' }))}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-[11px] sm:text-xs transition-colors text-left',
                        debtForm.direction === 'empresa_operario'
                          ? 'border-green-500/40 bg-green-500/10 text-green-400'
                          : 'border-white/8 bg-white/3 text-gray-400 hover:bg-white/8'
                      )}
                    >
                      <TrendingDown size={11} className="mb-1" />
                      Empresa → Op.
                    </button>
                    <button
                      onClick={() => setDebtForm(f => ({ ...f, direction: 'operario_empresa' }))}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-[11px] sm:text-xs transition-colors text-left',
                        debtForm.direction === 'operario_empresa'
                          ? 'border-red-500/40 bg-red-500/10 text-red-400'
                          : 'border-white/8 bg-white/3 text-gray-400 hover:bg-white/8'
                      )}
                    >
                      <TrendingUp size={11} className="mb-1" />
                      Op. → Empresa
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Monto"
                      value={debtForm.amount}
                      onChange={e => setDebtForm(f => ({ ...f, amount: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Descripción (opcional)"
                      value={debtForm.description}
                      onChange={e => setDebtForm(f => ({ ...f, description: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    />
                  </div>
                  <Button variant="primary" size="sm" className="w-full" onClick={handleAddDebt}>
                    Guardar deuda
                  </Button>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {unpaidCompanyOwes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <TrendingDown size={12} className="text-green-400" />
                Empresa le debe al operario
              </p>
              {unpaidCompanyOwes.map(debt => {
                const remaining = Number(debt.amount) - Number(debt.paid_amount)
                return (
                  <div key={debt.id} className="flex items-center justify-between rounded-xl border border-green-500/15 bg-green-500/5 px-3 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-400">${cop(remaining)} <span className="text-xs text-gray-500 font-normal">de ${cop(debt.amount)}</span></p>
                      {debt.description && <p className="text-xs text-gray-500 truncate">{debt.description}</p>}
                      <p className="text-[10px] text-gray-600">{format(parseISO(debt.created_at), "d MMM yyyy", { locale: es })}</p>
                    </div>
                    <button onClick={() => handleMarkPaid(debt.id)} className="shrink-0 flex items-center gap-1 rounded-lg bg-green-500/15 px-2.5 py-1 text-xs text-green-400 hover:bg-green-500/25 transition-colors">
                      <Check size={11} /> Pagada
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {unpaidOperatorOwes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <TrendingUp size={12} className="text-red-400" />
                Operario le debe a la empresa
              </p>
              {unpaidOperatorOwes.map(debt => {
                const remaining = Number(debt.amount) - Number(debt.paid_amount)
                return (
                  <div key={debt.id} className="flex items-center justify-between rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-400">${cop(remaining)} <span className="text-xs text-gray-500 font-normal">de ${cop(debt.amount)}</span></p>
                      {debt.description && <p className="text-xs text-gray-500 truncate">{debt.description}</p>}
                      <p className="text-[10px] text-gray-600">{format(parseISO(debt.created_at), "d MMM yyyy", { locale: es })}</p>
                      {debt.payments && debt.payments.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {debt.payments.map(p => (
                            <p key={p.id} className="text-[10px] text-gray-600">
                              Abono ${cop(p.amount)} · {format(parseISO(p.created_at), "d MMM yyyy", { locale: es })}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleMarkPaid(debt.id)} className="shrink-0 flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1 text-xs text-gray-400 hover:bg-white/12 transition-colors">
                      <Check size={11} /> Pagada
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {paidDebts.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer transition-colors list-none flex items-center gap-1">
                <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                {paidDebts.length} deuda{paidDebts.length !== 1 ? 's' : ''} pagada{paidDebts.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-1.5">
                {paidDebts.map(debt => (
                  <div key={debt.id} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2 gap-3 opacity-50">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">
                        {debt.direction === 'empresa_operario' ? 'Empresa → Operario' : 'Operario → Empresa'} · ${cop(debt.amount)}
                      </p>
                      {debt.description && <p className="text-[10px] text-gray-600 truncate">{debt.description}</p>}
                    </div>
                    <Badge variant="green" className="text-[10px] shrink-0">Pagada</Badge>
                  </div>
                ))}
              </div>
            </details>
          )}

          {debts.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-3">Sin deudas registradas</p>
          )}
        </div>
      </div>
    )
  }

  // ── Operator grid ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Liquidación de Operarios" subtitle="Selecciona un operario para ver su liquidación" />

      {opsLoading ? (
        <div className="flex justify-center py-12">
          <p className="text-sm text-gray-500">Cargando operarios...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {operators.map((operator, idx) => {
            const color = OP_COLORS[idx % OP_COLORS.length]
            return (
              <motion.button
                key={operator.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setSelectedOp(operator.id); setWeekOffset(0) }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-6 hover:bg-white/[0.06] hover:border-white/15 transition-all duration-200"
              >
                <div className={cn('rounded-2xl p-3 sm:p-4 text-xl sm:text-2xl font-bold leading-none min-w-[52px] sm:min-w-[64px] text-center', color.bg, color.text)}>
                  {getInitials(operator.name)}
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-200 text-center leading-tight">{operator.name}</p>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
