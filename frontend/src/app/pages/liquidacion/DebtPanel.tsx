import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Check, X, TrendingUp, TrendingDown, ChevronRight, Banknote,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/app/components/ui/Button'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { Badge } from '@/app/components/ui/Badge'
import { cn } from '@/app/components/ui/cn'
import type { ApiDebt } from '@/api'
import { parseCOP, fmtCOP, cop } from './helpers'

interface DebtForm {
  direction: 'empresa_operario' | 'operario_empresa'
  amount: string
  description: string
}

interface DebtPanelProps {
  debts: ApiDebt[]
  selectedOp: number | null
  addDebtOpen: boolean
  setAddDebtOpen: (open: boolean) => void
  debtForm: DebtForm
  setDebtForm: (fn: (prev: DebtForm) => DebtForm) => void
  onAddDebt: () => void
  onMarkPaid: (debtId: number) => void
  onPayDebt: () => void   // opens PayDebtModal
}

export function DebtPanel({
  debts,
  selectedOp: _selectedOp,
  addDebtOpen,
  setAddDebtOpen,
  debtForm,
  setDebtForm,
  onAddDebt,
  onMarkPaid: _onMarkPaid,
  onPayDebt,
}: DebtPanelProps) {
  const unpaidCompanyOwes  = debts.filter(d => d.direction === 'empresa_operario' && !d.paid)
  const unpaidOperatorOwes = debts.filter(d => d.direction === 'operario_empresa' && !d.paid)
  const paidDebts          = debts.filter(d => d.paid)

  const totalCompanyOwes   = unpaidCompanyOwes.reduce((s, d) => s + Number(d.amount) - Number(d.paid_amount), 0)
  const totalOperatorOwes  = unpaidOperatorOwes.reduce((s, d) => s + Number(d.amount) - Number(d.paid_amount), 0)

  return (
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

      {/* Add debt form */}
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
                  type="text" inputMode="numeric"
                  placeholder="Monto"
                  value={fmtCOP(debtForm.amount)}
                  onChange={e => setDebtForm(f => ({ ...f, amount: parseCOP(e.target.value) }))}
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
              <Button variant="primary" size="sm" className="w-full" onClick={onAddDebt}>
                Guardar deuda
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aggregate totals */}
      {(totalCompanyOwes > 0 || totalOperatorOwes > 0) && (
        <div className="space-y-2">
          {/* Empresa owes operator */}
          {totalCompanyOwes > 0 && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                    <TrendingDown size={11} className="text-green-400" />
                    La empresa debe al operario
                  </p>
                  <p className="text-xl font-bold text-green-400">${cop(totalCompanyOwes)}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {unpaidCompanyOwes.length} deuda{unpaidCompanyOwes.length !== 1 ? 's' : ''} pendiente{unpaidCompanyOwes.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="primary" size="sm"
                  onClick={onPayDebt}
                  className="shrink-0 mt-1"
                >
                  <Banknote size={13} />
                  Pagar
                </Button>
              </div>

              {/* Individual debt breakdown (collapsed) */}
              <details className="mt-2 group">
                <summary className="text-[11px] text-gray-600 hover:text-gray-400 cursor-pointer transition-colors list-none flex items-center gap-1">
                  <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
                  Ver detalle
                </summary>
                <div className="mt-2 space-y-1.5">
                  {unpaidCompanyOwes.map(debt => {
                    const remaining = Number(debt.amount) - Number(debt.paid_amount)
                    return (
                      <div key={debt.id} className="flex items-center justify-between gap-2 py-1 border-t border-green-500/10">
                        <div className="min-w-0">
                          <p className="text-xs text-green-400 font-medium">${cop(remaining)}</p>
                          {debt.description && <p className="text-[10px] text-gray-600 truncate">{debt.description}</p>}
                          <p className="text-[10px] text-gray-700">{format(parseISO(debt.created_at), "d MMM yyyy", { locale: es })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            </div>
          )}

          {/* Operator owes company */}
          {totalOperatorOwes > 0 && (
            <div className="rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3">
              <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                <TrendingUp size={11} className="text-red-400" />
                El operario debe a la empresa
              </p>
              <p className="text-xl font-bold text-red-400">${cop(totalOperatorOwes)}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {unpaidOperatorOwes.length} deuda{unpaidOperatorOwes.length !== 1 ? 's' : ''} pendiente{unpaidOperatorOwes.length !== 1 ? 's' : ''} · se descuenta en próxima liquidación
              </p>
              {/* breakdown */}
              <details className="mt-2 group">
                <summary className="text-[11px] text-gray-600 hover:text-gray-400 cursor-pointer transition-colors list-none flex items-center gap-1">
                  <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
                  Ver detalle
                </summary>
                <div className="mt-2 space-y-1.5">
                  {unpaidOperatorOwes.map(debt => {
                    const remaining = Number(debt.amount) - Number(debt.paid_amount)
                    return (
                      <div key={debt.id} className="flex items-center justify-between gap-2 py-1 border-t border-red-500/10">
                        <div className="min-w-0">
                          <p className="text-xs text-red-400 font-medium">${cop(remaining)}</p>
                          {debt.description && <p className="text-[10px] text-gray-600 truncate">{debt.description}</p>}
                          <p className="text-[10px] text-gray-700">{format(parseISO(debt.created_at), "d MMM yyyy", { locale: es })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Paid debts history */}
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
  )
}
