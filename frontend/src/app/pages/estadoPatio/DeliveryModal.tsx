import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/app/components/ui/Button'
import { Select } from '@/app/components/ui/Select'
import { cn } from '@/app/components/ui/cn'
import type { ApiPatioEntry } from '@/api'
import { useAppContext } from '@/app/context/AppContext'
import type { FacturaRecord } from './types'
import { fmtCOP, parseCOP } from './utils'

type Operators = ReturnType<typeof useAppContext>['operators']

interface DeliveryModalProps {
  paymentEntry:    ApiPatioEntry
  onClose:         () => void
  payMethods:      Record<string, string>
  setPayMethods:   React.Dispatch<React.SetStateAction<Record<string, string>>>
  togglePayMethod: (key: string) => void
  delivering:      boolean
  applyIva:        boolean
  setApplyIva:     React.Dispatch<React.SetStateAction<boolean>>
  deliveryOpId:    string
  setDeliveryOpId: (id: string) => void
  deliveryOps:     Operators
  factura:         boolean
  setFactura:      React.Dispatch<React.SetStateAction<boolean>>
  facturaData:     FacturaRecord
  setFacturaData:  React.Dispatch<React.SetStateAction<FacturaRecord>>
  onConfirm:       () => Promise<void>
}

const METHODS = [
  { key: 'cash',        label: 'Efectivo',            sub: null },
  { key: 'datafono',    label: 'Banco Caja Social',   sub: null },
  { key: 'nequi',       label: 'Nequi',               sub: '3118777229 · NEQUIJUL11739' },
  { key: 'bancolombia', label: 'Bancolombia Ahorros',  sub: '60123354942 · @SaraP9810' },
]

const DETALLADO_CATS = new Set(['exterior', 'interior', 'ceramico', 'correccion_pintura'])

export function DeliveryModal({
  paymentEntry, onClose,
  payMethods, setPayMethods, togglePayMethod,
  delivering,
  applyIva, setApplyIva,
  deliveryOpId, setDeliveryOpId, deliveryOps,
  factura, setFactura, facturaData, setFacturaData,
  onConfirm,
}: DeliveryModalProps) {
  const total              = Number(paymentEntry.order?.total ?? 0)
  const abono              = Number(paymentEntry.order?.downpayment ?? 0)
  const restante           = Math.max(0, total - abono)
  const nonDetailladoTotal = (paymentEntry.order?.items ?? [])
    .filter(i => !DETALLADO_CATS.has(i.service_category))
    .reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)
  const ivaAmt             = Math.round(nonDetailladoTotal * 0.19)
  const effectiveRestante  = applyIva ? restante + ivaAmt : restante

  const checkedKeys = Object.keys(payMethods)
  const isMulti     = checkedKeys.length > 1
  const covered     = isMulti ? checkedKeys.reduce((s, k) => s + (Number(payMethods[k]) || 0), 0) : effectiveRestante
  const diff        = effectiveRestante - covered

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h3 className="text-base font-semibold text-white">Entregar Vehículo</h3>
          <p className="text-sm text-gray-500 mt-1">
            {paymentEntry.vehicle?.brand} {paymentEntry.vehicle?.model} ·{' '}
            <span className="text-gray-300">{paymentEntry.vehicle?.plate}</span>
          </p>
        </div>

        {/* Detallado operator selector */}
        {deliveryOps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Operario *</p>
            <Select
              value={deliveryOpId || '0'}
              onValueChange={v => setDeliveryOpId(v === '0' ? '' : v)}
              options={[
                { value: '0', label: 'Seleccionar operario...' },
                ...deliveryOps.map(op => ({ value: String(op.id), label: op.name })),
              ]}
            />
          </div>
        )}

        {/* Amount summary */}
        <div className="rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 space-y-1">
          {abono > 0 && (
            <>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Total servicio</span>
                <span>${total.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Abono previo</span>
                <span className="text-green-400">−${abono.toLocaleString('es-CO')}</span>
              </div>
              <div className="border-t border-white/8 pt-1 mt-1" />
            </>
          )}
          <div className="flex justify-between text-sm font-bold">
            <span className="text-gray-300">A cobrar</span>
            <span className={cn('transition-colors', applyIva ? 'text-blue-300' : 'text-yellow-400')}>
              ${effectiveRestante.toLocaleString('es-CO')}
            </span>
          </div>
          {applyIva && restante > 0 && (
            <div className="flex justify-between text-[11px] text-blue-400/60">
              <span>Incluye IVA 19%</span>
              <span>+${ivaAmt.toLocaleString('es-CO')}</span>
            </div>
          )}
          {restante > 0 && (
            <div className="pt-1 mt-0.5 border-t border-white/5">
              <button
                type="button"
                onClick={() => { setApplyIva(v => !v); setPayMethods({}) }}
                className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                <div className={cn(
                  'w-3 h-3 rounded border shrink-0 flex items-center justify-center transition-colors',
                  applyIva ? 'border-blue-500/60 bg-blue-500/50' : 'border-white/20'
                )}>
                  {applyIva && <svg viewBox="0 0 10 8" className="w-2 h-1.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l2.5 2.5L9 1"/></svg>}
                </div>
                Aplicar IVA (19%)
              </button>
            </div>
          )}
        </div>

        {/* Payment method checkboxes */}
        {effectiveRestante > 0 && (
          <>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Método de pago</p>
              <div className="space-y-1.5">
                {METHODS.map(m => {
                  const isChecked = m.key in payMethods
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => togglePayMethod(m.key)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        isChecked
                          ? 'border-yellow-500/60 bg-yellow-500/10'
                          : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                        isChecked ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600 bg-transparent'
                      )}>
                        {isChecked && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-gray-900" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 4l2.5 2.5L9 1" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-medium', isChecked ? 'text-yellow-300' : 'text-gray-300')}>
                          {m.label}
                        </p>
                        {m.sub && <p className="text-[11px] text-gray-600 mt-0.5">{m.sub}</p>}
                      </div>
                      {isChecked && isMulti && (
                        <input
                          type="text" inputMode="numeric" placeholder="0"
                          value={fmtCOP(payMethods[m.key] ?? '')}
                          onChange={e => { e.stopPropagation(); setPayMethods(prev => ({ ...prev, [m.key]: parseCOP(e.target.value) })) }}
                          onClick={e => e.stopPropagation()}
                          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-right text-gray-100 focus:border-yellow-500/50 focus:outline-none"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Balance indicator for multi-method */}
            {isMulti && (
              <div className={cn(
                'text-xs text-center rounded-xl px-3 py-2 font-medium',
                diff === 0 ? 'text-green-400 bg-green-500/10 border border-green-500/20' :
                diff <  0 ? 'text-blue-400  bg-blue-500/10  border border-blue-500/20'  :
                            'text-orange-400 bg-orange-500/10 border border-orange-500/20'
              )}>
                {diff === 0 && '✓ Pago completo'}
                {diff <  0 && `Cambio al cliente: $${Math.abs(diff).toLocaleString('es-CO')}`}
                {diff >  0 && `Pendiente: $${diff.toLocaleString('es-CO')}`}
              </div>
            )}
          </>
        )}

        {/* Facturación electrónica */}
        <div className="border-t border-white/8 pt-4 space-y-3">
          <button
            type="button"
            onClick={() => setFactura(f => !f)}
            className="flex items-center gap-3 w-full text-left"
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
              factura ? 'border-blue-500 bg-blue-500' : 'border-gray-600 bg-transparent'
            )}>
              {factura && (
                <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4l2.5 2.5L9 1" />
                </svg>
              )}
            </div>
            <span className={cn('text-sm font-medium', factura ? 'text-blue-300' : 'text-gray-400')}>
              Requiere facturación electrónica
            </span>
          </button>

          <AnimatePresence initial={false}>
            {factura && (
              <motion.div
                key="factura-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  {/* Tipo */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Tipo</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['persona_natural', 'empresa'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFacturaData(f => ({
                            ...f,
                            tipo:    t,
                            id_type: t === 'empresa' ? 'NIT' : 'CC',
                            dv:      '',
                          }))}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                            facturaData.tipo === t
                              ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                              : 'border-white/8 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]'
                          )}
                        >
                          {t === 'persona_natural' ? 'Persona Natural' : 'Empresa'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de identificación */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Tipo de identificación</label>
                    <select
                      value={facturaData.id_type}
                      onChange={e => setFacturaData(f => ({ ...f, id_type: e.target.value, dv: '' }))}
                      className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-gray-100 focus:border-blue-500/50 focus:outline-none appearance-none"
                    >
                      {facturaData.tipo === 'empresa' ? (
                        <>
                          <option value="NIT" className="bg-gray-800">NIT</option>
                          <option value="CE"  className="bg-gray-800">Cédula de Extranjería</option>
                        </>
                      ) : (
                        <>
                          <option value="CC" className="bg-gray-800">Cédula de Ciudadanía</option>
                          <option value="CE" className="bg-gray-800">Cédula de Extranjería</option>
                          <option value="PP" className="bg-gray-800">Pasaporte</option>
                          <option value="TI" className="bg-gray-800">Tarjeta de Identidad</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Número de identificación + DV */}
                  <div className={cn('grid gap-2', facturaData.id_type === 'NIT' ? 'grid-cols-[1fr_4rem]' : 'grid-cols-1')}>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">Identificación</label>
                      <input
                        type="text"
                        value={facturaData.id_number}
                        onChange={e => setFacturaData(f => ({ ...f, id_number: e.target.value }))}
                        placeholder="Número de identificación"
                        className={inputCls}
                      />
                    </div>
                    {facturaData.id_type === 'NIT' && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1.5">Dv</label>
                        <input
                          type="text"
                          maxLength={1}
                          value={facturaData.dv}
                          onChange={e => setFacturaData(f => ({ ...f, dv: e.target.value.replace(/\D/, '') }))}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>

                  {/* Nombre + Teléfono */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">Nombre</label>
                      <input
                        type="text"
                        value={facturaData.name}
                        onChange={e => setFacturaData(f => ({ ...f, name: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">Teléfono</label>
                      <input
                        type="text"
                        value={facturaData.phone}
                        onChange={e => setFacturaData(f => ({ ...f, phone: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Correo electrónico */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Correo electrónico</label>
                    <input
                      type="email"
                      value={facturaData.email}
                      onChange={e => setFacturaData(f => ({ ...f, email: e.target.value }))}
                      placeholder="cliente@ejemplo.com"
                      className={inputCls}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" className="flex-1"
            onClick={onConfirm}
            disabled={
              delivering
              || (effectiveRestante > 0 && checkedKeys.length === 0)
              || (deliveryOps.length > 0 && !deliveryOpId)
            }>
            {delivering ? 'Entregando...' : 'Confirmar Entrega'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
