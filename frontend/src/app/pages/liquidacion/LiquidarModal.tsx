import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Banknote, Phone, CreditCard, TrendingUp, TrendingDown, Check, X, Scissors,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/app/components/ui/Button'
import { cn } from '@/app/components/ui/cn'
import type { ApiLiqWeekResponse, ApiDebt, LiquidatePayload } from '@/api'
import type { Operator } from '@/types'
import { parseCOP, fmtCOP, cop } from './helpers'

interface LiquidarModalProps {
  open: boolean
  onClose: () => void
  operator: Operator
  weekData: ApiLiqWeekResponse
  debts: ApiDebt[]
  onConfirm: (payload: LiquidatePayload) => Promise<void>
}

export function LiquidarModal({ open, onClose, operator: _operator, weekData, debts, onConfirm }: LiquidarModalProps) {
  // Only compute commission for unliquidated orders
  // Backend already filters items by operator category and uses standard prices
  const unliqOrders  = weekData.days.flatMap(d => d.orders.filter(o => !o.is_liquidated))
  const unliqGross   = unliqOrders.reduce((s, o) => s + Number(o.total), 0)
  const commission   = weekData.operator_type === 'pintura'
    ? unliqOrders.reduce((s, o) => s + Number(o.piece_count ?? 0), 0) * 90000
    : Math.round(unliqGross * Number(weekData.commission_rate)) / 100

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
  const [partialMode,   setPartialMode]   = useState(false)
  const [partialInput,  setPartialInput]  = useState('')

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
    setPartialMode(false)
    setPartialInput('')
  }, [open])

  const totalAbonos  = unpaidOpOwes.reduce((s, d) => s + (Number(abonoInputs[d.id]) || 0), 0)
  const totalSettled = unpaidCompanyOwes.reduce((s, d) =>
    s + (settleInputs[d.id]?.include ? (Number(settleInputs[d.id]?.amount) || 0) : 0), 0)
  const netAmount    = commission - totalAbonos + totalSettled

  // Partial payment: cap what the user commits to paying now
  const parsedPartial = Number(parseCOP(partialInput)) || 0
  const effectiveNet  = partialMode
    ? Math.min(Math.max(0, parsedPartial), netAmount)
    : netAmount

  function getPayAmount(key: string): number {
    if (!paySelected.has(key)) return 0
    if (paySelected.size === 1) return Math.max(0, effectiveNet)
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

  function togglePartialMode() {
    setPartialMode(p => !p)
    setPartialInput('')
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
                <h2 className="text-base font-semibold text-white">Liquidar servicios pendientes</h2>
                <p className="text-xs text-gray-500">
                  {unliqOrders.length} servicio{unliqOrders.length !== 1 ? 's' : ''} sin liquidar
                  {weekData.week_start !== weekData.week_end && ` · desde ${format(parseISO(weekData.week_start), "d MMM", { locale: es })}`}
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
                  Servicios a liquidar ({unliqOrders.length})
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{unliqOrders.length} servicios sin liquidar · Total bruto</span>
                  <span className="text-gray-200">${cop(unliqGross)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    {weekData.operator_type === 'pintura'
                      ? `Comisión (${weekData.piece_count ?? 0} piezas × $90.000)`
                      : `Comisión (${Number(weekData.commission_rate)}%)`}
                  </span>
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
                            type="text" inputMode="numeric"
                            placeholder="0"
                            value={fmtCOP(abonoInputs[debt.id] ?? '')}
                            onChange={e => {
                              const raw = parseCOP(e.target.value)
                              const capped = raw === '' ? '' : String(Math.min(Number(raw), remaining))
                              setAbonoInputs(p => ({ ...p, [debt.id]: capped }))
                            }}
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
                              type="text" inputMode="numeric"
                              value={fmtCOP(state.amount ?? '')}
                              onChange={e => {
                                const raw = parseCOP(e.target.value)
                                const capped = raw === '' ? '' : String(Math.min(Number(raw), remaining))
                                setSettleInputs(p => ({ ...p, [debt.id]: { ...p[debt.id], amount: capped } }))
                              }}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Método de pago</p>
                  <button
                    type="button"
                    onClick={togglePartialMode}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all',
                      partialMode
                        ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300'
                    )}
                  >
                    <Scissors size={11} />
                    Pago parcial
                    {partialMode && <Check size={11} />}
                  </button>
                </div>

                {/* Partial amount input */}
                {partialMode && (
                  <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 space-y-2">
                    <p className="text-xs text-orange-300/80">Ingresa cuánto vas a pagar ahora. El resto quedará como deuda hacia el operario.</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">Monto a pagar:</span>
                      <input
                        type="text" inputMode="numeric"
                        placeholder={`Máx $${cop(netAmount)}`}
                        value={fmtCOP(partialInput)}
                        onChange={e => {
                          const raw = parseCOP(e.target.value)
                          const capped = raw === '' ? '' : String(Math.min(Number(raw), netAmount))
                          setPartialInput(capped)
                          setPayAmounts({})
                        }}
                        className="flex-1 rounded-lg border border-orange-500/30 bg-white/5 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-orange-400/60 focus:outline-none"
                      />
                    </div>
                    {parsedPartial > 0 && parsedPartial < netAmount && (
                      <p className="text-xs text-orange-400 font-medium">
                        Deuda que quedará: ${cop(netAmount - Math.min(parsedPartial, netAmount))}
                      </p>
                    )}
                  </div>
                )}

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
                            const capped = Math.min(raw, Math.max(0, effectiveNet - otherTotal))
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
                disabled={submitting || paySelected.size === 0 || (partialMode && parsedPartial <= 0)}
              >
                <Banknote size={16} />
                {submitting ? 'Procesando...'
                  : paySelected.size === 0 ? 'Selecciona un método de pago'
                  : partialMode && parsedPartial <= 0 ? 'Ingresa el monto parcial'
                  : 'Confirmar liquidación'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
