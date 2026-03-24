import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, ChevronLeft, ChevronRight, ChevronDown,
  Plus, Check, X, TrendingUp, TrendingDown, Download, Banknote,
  Phone, CreditCard, Calendar,
} from 'lucide-react'
import { format, startOfWeek, addWeeks, addDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiLiqWeekResponse, type ApiDebt, type LiquidatePayload, type ApiReportResponse } from '@/api'
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

function escapeHtml(s: string | undefined | null) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
  // Only compute commission for unliquidated orders
  const unliqOrders  = weekData.days.flatMap(d => d.orders.filter(o => !o.is_liquidated))
  const unliqGross   = unliqOrders.reduce((s, o) => s + Number(o.total), 0)
  const commission   = Math.round(unliqGross * Number(weekData.commission_rate)) / 100

  const unpaidOpOwes      = debts.filter(d => d.direction === 'operario_empresa' && !d.paid)
  const unpaidCompanyOwes = debts.filter(d => d.direction === 'empresa_operario' && !d.paid)

  const PAY_METHODS = [
    { key: 'payment_cash',        label: 'Efectivo',          icon: <Banknote size={14} /> },
    { key: 'payment_datafono',    label: 'Banco Caja Social', icon: <CreditCard size={14} /> },
    { key: 'payment_nequi',       label: 'Nequi',             icon: <Phone size={14} /> },
    { key: 'payment_bancolombia', label: 'Bancolombia',       icon: <CreditCard size={14} /> },
  ] as const

  const [abonoInputs,   setAbonoInputs]   = useState<Record<number, string>>({})
  const [settleInputs,  setSettleInputs]  = useState<Record<number, { include: boolean; amount: string }>>({})
  const [paySelected,   setPaySelected]   = useState<Set<string>>(new Set())
  const [payAmounts,    setPayAmounts]    = useState<Record<string, string>>({})
  const [submitting,    setSubmitting]    = useState(false)

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
    setPaySelected(new Set())
    setPayAmounts({})
  }, [open])

  const totalAbonos  = unpaidOpOwes.reduce((s, d) => s + (Number(abonoInputs[d.id]) || 0), 0)
  const totalSettled = unpaidCompanyOwes.reduce((s, d) =>
    s + (settleInputs[d.id]?.include ? (Number(settleInputs[d.id]?.amount) || 0) : 0), 0)
  const netAmount    = commission - totalAbonos + totalSettled

  function getPayAmount(key: string): number {
    if (!paySelected.has(key)) return 0
    if (paySelected.size === 1) return Math.max(0, netAmount)
    return Number(payAmounts[key]) || 0
  }

  const totalPaid = PAY_METHODS.reduce((s, m) => s + getPayAmount(m.key), 0)
  const pending   = Math.max(0, netAmount - totalPaid)

  function togglePayMethod(key: string) {
    setPaySelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setPayAmounts({})
  }

  async function handleConfirm() {
    setSubmitting(true)
    const payload: LiquidatePayload = {
      abonos: unpaidOpOwes
        .filter(d => Number(abonoInputs[d.id]) > 0)
        .map(d => ({ debt_id: d.id, amount: Number(abonoInputs[d.id]) })),
      company_settlements: unpaidCompanyOwes
        .filter(d => settleInputs[d.id]?.include && Number(settleInputs[d.id]?.amount) > 0)
        .map(d => ({ debt_id: d.id, amount: Number(settleInputs[d.id].amount) })),
      payment_cash:        getPayAmount('payment_cash'),
      payment_datafono:    getPayAmount('payment_datafono'),
      payment_nequi:       getPayAmount('payment_nequi'),
      payment_bancolombia: getPayAmount('payment_bancolombia'),
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
              {/* Comisión — solo servicios sin liquidar */}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Servicios a liquidar ({weekData.unliquidated_count})
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{weekData.unliquidated_count} servicios sin liquidar · Total bruto</span>
                  <span className="text-gray-200">${cop(unliqGross)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Comisión ({Number(weekData.commission_rate)}%)</span>
                  <span className="text-yellow-400 font-semibold">${cop(commission)}</span>
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

                {/* Method checkboxes */}
                <div className="grid grid-cols-2 gap-2">
                  {PAY_METHODS.map(m => {
                    const active = paySelected.has(m.key)
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => togglePayMethod(m.key)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all',
                          active
                            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-200'
                        )}
                      >
                        {m.icon}
                        <span className="text-xs font-medium">{m.label}</span>
                        {active && <Check size={12} className="ml-auto shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                {/* Multi-method amount inputs */}
                {paySelected.size > 1 && (
                  <div className="space-y-2">
                    {PAY_METHODS.filter(m => paySelected.has(m.key)).map(m => (
                      <div key={m.key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-28 shrink-0">{m.label}</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={payAmounts[m.key] ?? ''}
                          onChange={e => {
                            const raw = Math.max(0, Number(e.target.value) || 0)
                            const otherTotal = PAY_METHODS
                              .filter(o => paySelected.has(o.key) && o.key !== m.key)
                              .reduce((s, o) => s + (Number(payAmounts[o.key]) || 0), 0)
                            const capped = Math.min(raw, Math.max(0, netAmount - otherTotal))
                            setPayAmounts(p => ({ ...p, [m.key]: String(capped) }))
                          }}
                          onWheel={e => e.currentTarget.blur()}
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Balance */}
                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Total pagado</span>
                    <span className={cn(totalPaid >= netAmount && totalPaid > 0 ? 'text-green-400' : 'text-gray-200')}>${cop(totalPaid)}</span>
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
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [customMonthOpen, setCustomMonthOpen] = useState(false)
  const [customMonthValue, setCustomMonthValue] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
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

  async function downloadReport(period: 'week' | 'month', refDate: string) {
    if (!selectedOp) return
    setReportModalOpen(false)
    try {
      const report = await api.liquidation.getReport(selectedOp, period, refDate)
      printReport(report)
    } catch {
      toast.error('Error al generar el reporte')
    }
  }

  async function downloadCustomMonth() {
    if (!selectedOp || !customMonthValue) return
    setCustomMonthOpen(false)
    try {
      const report = await api.liquidation.getReport(selectedOp, 'month', `${customMonthValue}-01`)
      printReport(report)
    } catch {
      toast.error('Error al generar el reporte')
    }
  }

  function printReport(r: ApiReportResponse) {
    const fmt     = (n: string | number) => `$${Number(n).toLocaleString('es-CO')}`
    const fmtDate = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
    const today   = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    const rate    = Number(r.commission_rate)

    // Group orders by their week (match against week_statuses)
    const weekSections = r.week_statuses
      .filter(w => Number(w.week_gross) > 0 || w.is_liquidated)
      .map(w => {
        const weekOrders = r.orders.filter(o => o.date >= w.week_start && o.date <= w.week_end)

        // Build service rows: all items from all orders, showing order context
        const serviceRows = weekOrders.flatMap(o => {
          const vehicle = [o.vehicle_brand, o.vehicle_model].filter(Boolean).join(' ') || '—'
          const orderComm = (Number(o.total) * rate / 100)
          const orderBadge = o.is_liquidated
            ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;">&#10003; LIQUIDADO</span>`
            : `<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;">&#10005; SIN LIQUIDAR</span>`
          const orderHeader = `<tr style="background:#f0f0f0;">
            <td colspan="3" style="padding:6px 10px;font-size:12px;font-weight:600;color:#444;">
              ${escapeHtml(o.order_number)} &nbsp;·&nbsp; ${escapeHtml(o.vehicle_plate)} &nbsp;·&nbsp; ${escapeHtml(vehicle)}
              <span style="font-weight:400;color:#999;margin-left:6px;">${escapeHtml(o.date)}</span>
              ${orderBadge}
            </td>
          </tr>`
          const items = o.items.map(i =>
            `<tr>
              <td style="padding:5px 10px 5px 20px;font-size:13px;color:#333;">${escapeHtml(i.service_name)}</td>
              <td style="padding:5px 10px;text-align:right;font-size:13px;color:#444;">${fmt(i.subtotal)}</td>
              <td style="padding:5px 10px;text-align:right;font-size:13px;color:#d97706;font-weight:500;">${fmt(Number(i.subtotal) * rate / 100)}</td>
            </tr>`
          ).join('')
          const orderTotal = `<tr style="border-top:1px dashed #ddd;background:#fafafa;">
            <td style="padding:5px 10px 5px 20px;font-size:12px;color:#888;font-style:italic;">Subtotal orden</td>
            <td style="padding:5px 10px;text-align:right;font-size:13px;font-weight:700;">${fmt(o.total)}</td>
            <td style="padding:5px 10px;text-align:right;font-size:13px;font-weight:700;color:#d97706;">${fmt(orderComm)}</td>
          </tr>`
          return orderHeader + items + orderTotal
        }).join('<tr><td colspan="3" style="height:6px;border:none;background:#fff;"></td></tr>')

        // Payment status badge — derived from actual order liquidation state
        const hasAnyLiquidated  = weekOrders.some(o => o.is_liquidated)
        const hasAllLiquidated  = weekOrders.length > 0 && weekOrders.every(o => o.is_liquidated)
        const badge = hasAllLiquidated
          ? `<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:0.3px;">&#10003; LIQUIDADA</span>`
          : hasAnyLiquidated
          ? `<span style="background:#fef9c3;color:#854d0e;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:0.3px;">&#9654; PARCIAL</span>`
          : `<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:0.3px;">&#10005; SIN LIQUIDAR</span>`

        // Estado de pago section — split by liquidation state
        const pendingAmt     = Number(w.amount_pending     ?? 0)
        const cashAmt        = Number(w.payment_cash        ?? 0)
        const datafonoAmt    = Number(w.payment_datafono    ?? 0)
        const nequiAmt       = Number(w.payment_nequi       ?? 0)
        const bancolombiaAmt = Number(w.payment_bancolombia ?? 0)

        // Compute per-state commission from orders (more accurate than w.week_commission for partial)
        const liqOrders   = weekOrders.filter(o => o.is_liquidated)
        const unliqOrders = weekOrders.filter(o => !o.is_liquidated)
        const liqComm     = liqOrders.reduce((s, o) => s + Number(o.total), 0) * rate / 100
        const unliqComm   = unliqOrders.reduce((s, o) => s + Number(o.total), 0) * rate / 100

        const totalPaid = cashAmt + datafonoAmt + nequiAmt + bancolombiaAmt

        // Build payment breakdown rows for non-zero methods
        const payRows = [
          ['Efectivo', cashAmt],
          ['Banco Caja Social', datafonoAmt],
          ['Nequi', nequiAmt],
          ['Bancolombia', bancolombiaAmt],
        ].filter(([, v]) => (v as number) > 0).map(([label, v]) =>
          `<div><div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${label}</div><div style="font-size:16px;font-weight:600;color:#1a1a1a;">${fmt(v as number)}</div></div>`
        ).join('<div style="width:1px;background:#d1d5db;align-self:stretch;"></div>')

        const payRowsCompact = [
          ['Efectivo', cashAmt],
          ['Banco Caja Social', datafonoAmt],
          ['Nequi', nequiAmt],
          ['Bancolombia', bancolombiaAmt],
        ].filter(([, v]) => (v as number) > 0).map(([label, v]) =>
          `<div style="font-size:11px;color:#6b7280;">${label}: <strong>${fmt(v as number)}</strong></div>`
        ).join('')

        const estadoPago = hasAllLiquidated
          ? `<div style="border-top:2px solid #166534;background:#f0fdf4;padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#166534;margin-bottom:12px;">Estado de pago — Liquidada</div>
              <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
                <div>
                  <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Comisión semana</div>
                  <div style="font-size:18px;font-weight:700;color:#1a1a1a;">${fmt(w.week_commission)}</div>
                </div>
                ${payRows ? `<div style="width:1px;background:#d1d5db;align-self:stretch;"></div>${payRows}` : ''}
                ${pendingAmt > 0 ? `<div style="width:1px;background:#d1d5db;align-self:stretch;"></div>
                <div>
                  <div style="font-size:11px;color:#dc2626;font-weight:600;margin-bottom:2px;">Pendiente por pagar</div>
                  <div style="font-size:16px;font-weight:700;color:#dc2626;">${fmt(pendingAmt)}</div>
                </div>` : ''}
                <div style="margin-left:auto;text-align:right;">
                  <div style="font-size:11px;color:#166534;font-weight:600;margin-bottom:2px;">Total pagado al operario</div>
                  <div style="font-size:20px;font-weight:800;color:#166534;">${fmt(totalPaid - pendingAmt)}</div>
                </div>
              </div>
            </div>`
          : hasAnyLiquidated
          ? `<div style="border-top:2px solid #854d0e;background:#fefce8;padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#854d0e;margin-bottom:12px;">Estado de pago — Parcialmente liquidada</div>
              <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:stretch;">
                <div style="flex:1;min-width:180px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;">
                  <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Ya pagado (${liqOrders.length} servicio${liqOrders.length !== 1 ? 's' : ''})</div>
                  <div style="font-size:11px;color:#6b7280;margin-bottom:1px;">Comisión liquidada</div>
                  <div style="font-size:16px;font-weight:700;color:#166534;">${fmt(liqComm)}</div>
                  <div style="margin-top:6px;">${payRowsCompact}</div>
                </div>
                <div style="flex:1;min-width:180px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;">
                  <div style="font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Sin liquidar (${unliqOrders.length} servicio${unliqOrders.length !== 1 ? 's' : ''})</div>
                  <div style="font-size:11px;color:#6b7280;margin-bottom:1px;">Comisión pendiente</div>
                  <div style="font-size:20px;font-weight:800;color:#dc2626;">${fmt(unliqComm)}</div>
                </div>
              </div>
            </div>`
          : `<div style="border-top:2px solid #dc2626;background:#fef2f2;padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#dc2626;margin-bottom:12px;">Estado de pago — Sin Liquidar</div>
              <div style="display:flex;gap:24px;align-items:center;">
                <div>
                  <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Comisión generada esta semana</div>
                  <div style="font-size:24px;font-weight:800;color:#dc2626;">${fmt(unliqComm)}</div>
                </div>
                <div style="margin-left:auto;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:10px 16px;text-align:right;">
                  <div style="font-size:12px;color:#991b1b;font-weight:600;">Pendiente de cobro por el operario</div>
                  <div style="font-size:18px;font-weight:800;color:#991b1b;margin-top:2px;">${fmt(unliqComm)}</div>
                </div>
              </div>
            </div>`

        // Week summary rows
        const summaryRows = `
          <tr style="background:#f9f9f9;border-top:2px solid #e5e5e5;">
            <td style="padding:7px 10px;font-size:13px;color:#555;"><strong>Total bruto semana</strong></td>
            <td style="padding:7px 10px;text-align:right;font-size:14px;font-weight:700;">${fmt(w.week_gross)}</td>
            <td style="padding:7px 10px;text-align:right;font-size:13px;color:#888;font-style:italic;">—</td>
          </tr>
          <tr style="background:#f9f9f9;">
            <td style="padding:4px 10px;font-size:13px;color:#555;">Comision del operario (${rate}%)</td>
            <td style="padding:4px 10px;text-align:right;font-size:13px;color:#888;font-style:italic;">—</td>
            <td style="padding:4px 10px;text-align:right;font-size:14px;font-weight:700;color:#d97706;">${fmt(w.week_commission)}</td>
          </tr>`

        return `
          <div style="margin-bottom:32px;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
            <div style="background:#1a1a1a;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:13px;">${fmtDate(w.week_start)} &nbsp;–&nbsp; ${fmtDate(w.week_end)}</span>
              ${badge}
            </div>
            ${weekOrders.length === 0
              ? '<p style="padding:12px 14px;color:#aaa;font-size:13px;">Sin servicios</p>'
              : `<table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:#333;color:#fff;">
                      <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Servicio</th>
                      <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Precio total</th>
                      <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#fbbf24;">Comision</th>
                    </tr>
                  </thead>
                  <tbody>${serviceRows}${summaryRows}</tbody>
                </table>`}
            ${estadoPago}
          </div>`
      }).join('')

    // ── Deudas pendientes empresa → operario ─────────────────────────────────
    const debtRows = r.pending_debts.map(d =>
      `<tr>
        <td style="padding:6px 10px;font-size:13px;">${escapeHtml(d.description || '—')}</td>
        <td style="padding:6px 10px;text-align:right;font-size:13px;">${fmt(d.amount)}</td>
        <td style="padding:6px 10px;text-align:right;font-size:13px;color:#888;">${fmt(d.paid_amount)}</td>
        <td style="padding:6px 10px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;">${fmt(d.remaining)}</td>
      </tr>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Liquidacion - ${escapeHtml(r.operator_name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; background: #fff; padding: 32px; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #222; }
  .logo { font-size: 20px; font-weight: 800; color: #d97706; letter-spacing: -0.5px; }
  .meta { font-size: 12px; color: #888; margin-top: 4px; }
  .op-card { display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 12px; }
  .totals-box { display: flex; justify-content: flex-end; margin-top: 4px; margin-bottom: 28px; }
  .totals-box table { width: 320px; border-collapse: collapse; }
  .totals-box td { padding: 6px 12px; font-size: 14px; }
  .totals-box tr.grand td { font-weight: 700; font-size: 16px; border-top: 2px solid #d97706; color: #d97706; padding-top: 10px; }
  .alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 16px; font-size: 13px; color: #dc2626; }
  .debts-table { width: 100%; border-collapse: collapse; }
  .debts-table th { background: #222; color: #fff; padding: 8px 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
  .debts-table td { padding: 6px 10px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body onload="window.print()">

<div class="header">
  <div>
    <div class="logo">BDCPolo</div>
    <div class="meta">Bogota Detailing Center</div>
  </div>
  <div style="text-align:right;">
    <h1>Liquidacion de Operario</h1>
    <div class="meta">${escapeHtml(r.period_label)}</div>
    <div class="meta">${escapeHtml(r.date_start)} al ${escapeHtml(r.date_end)} &nbsp;·&nbsp; Generado el ${today}</div>
  </div>
</div>

<div class="op-card">
  <div>
    <div style="font-size:16px;font-weight:700;">${escapeHtml(r.operator_name)}</div>
    <div style="font-size:13px;color:#666;margin-top:3px;">Comision: ${rate}% &nbsp;·&nbsp; ${r.total_services} servicio${r.total_services !== 1 ? 's' : ''} en el periodo</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:12px;color:#888;">Total bruto</div>
    <div style="font-size:18px;font-weight:700;">${fmt(r.gross_total)}</div>
    <div style="font-size:12px;color:#d97706;font-weight:600;">Comision: ${fmt(r.commission_amount)}</div>
  </div>
</div>

<div class="section-title">Detalle por semana</div>
${weekSections || '<p style="color:#aaa;font-size:13px;margin-bottom:24px;">Sin actividad en este periodo.</p>'}

<div class="totals-box">
  <table>
    <tr>
      <td style="color:#888;">Total bruto del periodo</td>
      <td style="text-align:right;font-weight:600;">${fmt(r.gross_total)}</td>
    </tr>
    <tr>
      <td style="color:#888;">Comision total (${rate}%)</td>
      <td style="text-align:right;font-weight:600;color:#d97706;">${fmt(r.commission_amount)}</td>
    </tr>
    ${Number(r.total_pending_owed) > 0 ? `<tr>
      <td style="color:#dc2626;font-weight:600;">+ Deudas empresa pendientes</td>
      <td style="text-align:right;color:#dc2626;font-weight:600;">${fmt(r.total_pending_owed)}</td>
    </tr>` : ''}
    <tr class="grand">
      <td>Total a favor del operario</td>
      <td style="text-align:right;">${fmt(Number(r.commission_amount) + Number(r.total_pending_owed))}</td>
    </tr>
  </table>
</div>

${r.pending_debts.length > 0 ? `
<div style="margin-bottom:28px;">
  <div class="section-title">Deudas de la empresa pendientes al operario</div>
  <table class="debts-table">
    <thead>
      <tr>
        <th style="text-align:left;">Descripcion</th>
        <th style="text-align:right;">Total deuda</th>
        <th style="text-align:right;">Ya pagado</th>
        <th style="text-align:right;">Pendiente</th>
      </tr>
    </thead>
    <tbody>${debtRows}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #222;">
        <td colspan="3" style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;">Total pendiente</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:14px;color:#dc2626;">${fmt(r.total_pending_owed)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="alert">La empresa le debe al operario <strong>${fmt(r.total_pending_owed)}</strong> en deudas pendientes.</div>
</div>` : ''}

<div class="footer">Bogota Detailing Center · BDCPolo · Comprobante interno de liquidacion</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (!win) { toast.error('Permite ventanas emergentes para descargar el PDF'); }
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
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

    const weekStartStr    = format(weekStart, 'yyyy-MM-dd')
    const now             = new Date()
    const isCurrentMonth  = weekStart.getFullYear() === now.getFullYear() && weekStart.getMonth() === now.getMonth()
    const monthBtnLabel   = isCurrentMonth
      ? `Mes actual (hasta hoy)`
      : `Mes de ${format(weekStart, 'MMMM yyyy', { locale: es })}`
    const monthBtnSub     = isCurrentMonth
      ? `Del 1 al ${format(now, 'd')} de ${format(now, 'MMMM', { locale: es })}`
      : `Mes completo de ${format(weekStart, 'MMMM yyyy', { locale: es })}`

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Report period picker modal */}
        <AnimatePresence>
          {reportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setReportModalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.95,  y: 8  }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Generar reporte</h2>
                  <button onClick={() => setReportModalOpen(false)} className="text-gray-500 hover:text-gray-300">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-400">Selecciona el período del reporte:</p>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => downloadReport('week', weekStartStr)}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 hover:border-yellow-500/30 transition-colors"
                  >
                    <div className="rounded-lg bg-yellow-500/15 p-2">
                      <Download size={16} className="text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Esta semana</p>
                      <p className="text-xs text-gray-500">
                        {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => downloadReport('month', weekStartStr)}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 hover:border-yellow-500/30 transition-colors"
                  >
                    <div className="rounded-lg bg-blue-500/15 p-2">
                      <Download size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{monthBtnLabel}</p>
                      <p className="text-xs text-gray-500 capitalize">{monthBtnSub}</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom month modal */}
        <AnimatePresence>
          {customMonthOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setCustomMonthOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.95,  y: 8  }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Factura por mes</h2>
                  <button onClick={() => setCustomMonthOpen(false)} className="text-gray-500 hover:text-gray-300">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-400">Elige el mes y año:</p>
                <input
                  type="month"
                  value={customMonthValue}
                  onChange={e => setCustomMonthValue(e.target.value)}
                  max={format(now, 'yyyy-MM')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none"
                />
                <button
                  onClick={downloadCustomMonth}
                  disabled={!customMonthValue}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-gray-900 hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={15} />
                  Generar factura
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 sm:px-3 sm:py-2 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
                >
                  <Download size={15} />
                  <span className="hidden sm:inline text-sm">Descargar</span>
                </button>
                <button
                  onClick={() => setCustomMonthOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 sm:px-3 sm:py-2 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
                  title="Factura de otro mes"
                >
                  <Calendar size={15} />
                  <span className="hidden sm:inline text-sm">Otro mes</span>
                </button>
              </div>
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

            <div className="space-y-2">
              {weekData.is_liquidated && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-green-500/25 bg-green-500/8 py-2.5">
                    <Check size={14} className="text-green-400" />
                    <span className="text-sm text-green-400 font-medium">
                      {weekData.unliquidated_count === 0 ? 'Semana completamente liquidada' : 'Semana parcialmente liquidada'}
                      {weekData.liquidated_at && (
                        <span className="text-green-600 font-normal ml-2">
                          · {format(new Date(weekData.liquidated_at), "d MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Payment breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {weekData.net_amount && (
                      <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                        <p className="text-gray-600">Neto pagado</p>
                        <p className="text-gray-200 font-semibold">${cop(weekData.net_amount)}</p>
                      </div>
                    )}
                    {Number(weekData.payment_cash_amount) > 0 && (
                      <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                        <p className="text-gray-600">Efectivo</p>
                        <p className="text-gray-200 font-semibold">${cop(weekData.payment_cash_amount!)}</p>
                      </div>
                    )}
                    {Number(weekData.payment_datafono_amount) > 0 && (
                      <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                        <p className="text-gray-600">Banco Caja Social</p>
                        <p className="text-gray-200 font-semibold">${cop(weekData.payment_datafono_amount!)}</p>
                      </div>
                    )}
                    {Number(weekData.payment_nequi_amount) > 0 && (
                      <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                        <p className="text-gray-600">Nequi</p>
                        <p className="text-gray-200 font-semibold">${cop(weekData.payment_nequi_amount!)}</p>
                      </div>
                    )}
                    {Number(weekData.payment_bancolombia_amount) > 0 && (
                      <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                        <p className="text-gray-600">Bancolombia</p>
                        <p className="text-gray-200 font-semibold">${cop(weekData.payment_bancolombia_amount!)}</p>
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
              )}
              <Button
                variant={weekData.unliquidated_count === 0 ? 'secondary' : 'primary'}
                size="md" className="w-full"
                onClick={() => setLiquidarOpen(true)}
                disabled={weekData.unliquidated_count === 0}
              >
                <Banknote size={16} />
                {weekData.unliquidated_count === 0
                  ? 'Todo liquidado'
                  : `${weekData.unliquidated_count} servicio${weekData.unliquidated_count !== 1 ? 's' : ''} sin liquidar`}
              </Button>
            </div>
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
