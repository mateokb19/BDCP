import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, UserPlus } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { cn } from '@/app/components/ui/cn'
import type { Operator } from '@/types'
import { OP_COLORS, OP_TYPE_STYLE, getInitials } from './helpers'

interface NewOpForm {
  name: string
  phone: string
  cedula: string
  commission_rate: string
  operator_type: string
}

interface OperatorGridProps {
  operators: Operator[]
  opsLoading: boolean
  onSelect: (id: number) => void
  newOpOpen: boolean
  setNewOpOpen: (open: boolean) => void
  newOpForm: NewOpForm
  setNewOpForm: (fn: (prev: NewOpForm) => NewOpForm) => void
  newOpSaving: boolean
  onCreateOperator: () => void
}

export function OperatorGrid({
  operators,
  opsLoading,
  onSelect,
  newOpOpen,
  setNewOpOpen,
  newOpForm,
  setNewOpForm,
  newOpSaving,
  onCreateOperator,
}: OperatorGridProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Liquidación de Operarios" subtitle="Selecciona un operario para ver su liquidación" />
        <button
          onClick={() => setNewOpOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/20 transition-colors shrink-0 mt-1"
        >
          <UserPlus size={15} /> Nuevo operario
        </button>
      </div>

      {/* New operator form */}
      <AnimatePresence>
        {newOpOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <GlassCard padding className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Nuevo operario</p>
                <button onClick={() => setNewOpOpen(false)} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
                  <input type="text" value={newOpForm.name}
                    onChange={e => setNewOpForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cédula</label>
                  <input type="text" value={newOpForm.cedula}
                    onChange={e => setNewOpForm(f => ({ ...f, cedula: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    placeholder="Número de cédula" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Teléfono</label>
                  <input type="text" value={newOpForm.phone}
                    onChange={e => setNewOpForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                    placeholder="3XX XXX XXXX" />
                </div>
                {newOpForm.operator_type === 'detallado' && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Porcentaje de comisión (%)</label>
                    <div className="relative">
                      <input type="text" inputMode="numeric" value={newOpForm.commission_rate}
                        onChange={e => setNewOpForm(f => ({ ...f, commission_rate: e.target.value.replace(/[^\d]/g, '') }))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 pr-8 text-sm text-gray-100 placeholder:text-gray-600 focus:border-yellow-500/50 focus:outline-none"
                        placeholder="30" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <select value={newOpForm.operator_type}
                  onChange={e => setNewOpForm(f => ({ ...f, operator_type: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none [color-scheme:dark]">
                  <option value="detallado">Detallado</option>
                  <option value="pintura">Pintura</option>
                  <option value="latoneria">Latonería</option>
                </select>
              </div>
              <Button variant="primary" size="sm" className="w-full" onClick={onCreateOperator} disabled={newOpSaving || !newOpForm.name.trim()}>
                {newOpSaving ? 'Guardando...' : <><Plus size={14} /> Crear operario</>}
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {opsLoading ? (
        <div className="flex justify-center py-12">
          <p className="text-sm text-gray-500">Cargando operarios...</p>
        </div>
      ) : (
        <>
          {(['detallado', 'pintura', 'latoneria'] as const).map(type => {
            const active   = operators.filter(o => o.active   && (o.operator_type ?? 'detallado') === type)
            const inactive = operators.filter(o => !o.active  && (o.operator_type ?? 'detallado') === type)
            if (active.length === 0 && inactive.length === 0) return null
            const typeStyle = OP_TYPE_STYLE[type]
            return (
              <div key={type} className="space-y-2">
                <p className={cn('text-xs font-semibold uppercase tracking-wider', typeStyle.cls.split(' ')[0])}>
                  {typeStyle.label}
                </p>
                {active.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {active.map((operator, idx) => {
                      const color = OP_COLORS[idx % OP_COLORS.length]
                      return (
                        <motion.button key={operator.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => onSelect(operator.id)}
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
                {inactive.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {inactive.map((operator) => (
                      <motion.button key={operator.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => onSelect(operator.id)}
                        className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.015] p-4 sm:p-6 hover:bg-white/[0.04] transition-all duration-200 opacity-60"
                      >
                        <div className="rounded-2xl p-3 sm:p-4 text-xl sm:text-2xl font-bold leading-none min-w-[52px] sm:min-w-[64px] text-center bg-gray-800 text-gray-500">
                          {getInitials(operator.name)}
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-gray-500 text-center leading-tight">{operator.name}</p>
                        <span className="text-[10px] text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">Inactivo</span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
