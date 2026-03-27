import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Banknote, Phone, CreditCard, Check, X, Scissors } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { cn } from '@/app/components/ui/cn'
import type { LiquidatePayload } from '@/api'
import { parseCOP, fmtCOP, cop } from './helpers'

interface PayDebtModalProps {
  open: boolean
  onClose: () => void
  totalOwed: number   // total empresa_operario remaining balance
  onConfirm: (payload: LiquidatePayload) => Promise<void>
}

export function PayDebtModal({ open, onClose, totalOwed, onConfirm }: PayDebtModalProps) {
  const PAY_METHODS = [
    { key: 'payment_cash',        label: 'Efectivo',          icon: <Banknote size={14} /> },
    { key: 'payment_datafono',    label: 'Banco Caja Social', icon: <CreditCard size={14} /> },
    { key: 'payment_nequi',       label: 'Nequi',             icon: <Phone size={14} /> },
    { key: 'payment_bancolombia', label: 'Bancolombia',       icon: <CreditCard size={14} /> },
  ] as const

  const [paySelected,   setPaySelected]   = useState<Set<string>>(new Set())
  const [payAmounts,    setPayAmounts]    = useState<Record<string, string>>({})
  const [partialMode,   setPartialMode]   = useState(false)
  const [partialInput,  setPartialInput]  = useState('')
  const [submitting,    setSubmitting]    = useState(false)

  useEffect(() => {
    if (!open) return
    setPaySelected(new Set())
    setPayAmounts({})
    setPartialMode(false)
    setPartialInput('')
  }, [open])

  const parsedPartial = Number(parseCOP(partialInput)) || 0
  const effectiveTotal = partialMode
    ? Math.min(Math.max(0, parsedPartial), totalOwed)
    : totalOwed

  function getPayAmount(key: string): number {
    if (!paySelected.has(key)) return 0
    if (paySelected.size === 1) return Math.max(0, effectiveTotal)
    return Number(payAmounts[key]) || 0
  }

  const totalPaid = PAY_METHODS.reduce((s, m) => s + getPayAmount(m.key), 0)

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

  const canConfirm = !submitting && paySelected.size > 0 && (!partialMode || parsedPartial > 0)

  async function handleConfirm() {
    setSubmitting(true)
    const payload: LiquidatePayload = {
      abonos: [],
      company_settlements: [],
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
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gray-900 shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gray-900 z-10">
              <div>
                <h2 className="text-base font-semibold text-white">Pagar deuda al operario</h2>
                <p className="text-xs text-gray-500">Total pendiente: <span className="text-green-400 font-semibold">${cop(totalOwed)}</span></p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
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

                {/* Partial input */}
                {partialMode && (
                  <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 space-y-2">
                    <p className="text-xs text-orange-300/80">Ingresa cuánto vas a pagar ahora. El resto seguirá como deuda pendiente.</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 shrink-0">Monto:</span>
                      <input
                        type="text" inputMode="numeric"
                        placeholder={`Máx $${cop(totalOwed)}`}
                        value={fmtCOP(partialInput)}
                        onChange={e => {
                          const raw = parseCOP(e.target.value)
                          const capped = raw === '' ? '' : String(Math.min(Number(raw), totalOwed))
                          setPartialInput(capped)
                          setPayAmounts({})
                        }}
                        className="flex-1 rounded-lg border border-orange-500/30 bg-white/5 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-orange-400/60 focus:outline-none"
                      />
                    </div>
                    {parsedPartial > 0 && parsedPartial < totalOwed && (
                      <p className="text-xs text-orange-400 font-medium">
                        Quedará pendiente: ${cop(totalOwed - Math.min(parsedPartial, totalOwed))}
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
                          type="number" min={0} placeholder="0"
                          value={payAmounts[m.key] ?? ''}
                          onChange={e => {
                            const raw = Math.max(0, Number(e.target.value) || 0)
                            const otherTotal = PAY_METHODS
                              .filter(o => paySelected.has(o.key) && o.key !== m.key)
                              .reduce((s, o) => s + (Number(payAmounts[o.key]) || 0), 0)
                            const capped = Math.min(raw, Math.max(0, effectiveTotal - otherTotal))
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
                    <span>A pagar ahora</span>
                    <span className={cn(totalPaid >= effectiveTotal && totalPaid > 0 ? 'text-green-400' : 'text-gray-200')}>${cop(totalPaid)}</span>
                  </div>
                  {partialMode && parsedPartial > 0 && parsedPartial < totalOwed && (
                    <div className="flex justify-between text-orange-400">
                      <span>Quedará como deuda</span>
                      <span className="font-semibold">${cop(totalOwed - effectiveTotal)}</span>
                    </div>
                  )}
                  {totalPaid >= effectiveTotal && totalPaid > 0 && (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <Check size={12} />
                      <span>{partialMode ? 'Pago parcial listo' : 'Pago completo'}</span>
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
                disabled={!canConfirm}
              >
                <Banknote size={16} />
                {submitting ? 'Procesando...'
                  : paySelected.size === 0 ? 'Selecciona un método de pago'
                  : partialMode && parsedPartial <= 0 ? 'Ingresa el monto parcial'
                  : 'Confirmar pago'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
