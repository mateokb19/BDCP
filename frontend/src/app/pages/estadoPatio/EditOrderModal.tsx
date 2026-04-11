import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { cn } from '@/app/components/ui/cn'
import type { ApiPatioEntry } from '@/api'
import { useAppContext } from '@/app/context/AppContext'
import type { EditForm } from './types'
import { CAT_TO_OP_TYPE, CATEGORY_LABELS, CATEGORY_ORDER, NO_OPERATOR_TYPES, OP_TYPE_LABEL } from './constants'
import { parseCOP, fmtCOP } from './utils'

type Operators = ReturnType<typeof useAppContext>['operators']
type Services  = ReturnType<typeof useAppContext>['services']

interface EditOrderModalProps {
  editingEntry:    ApiPatioEntry
  onClose:         () => void
  editForm:        EditForm
  setEditForm:     React.Dispatch<React.SetStateAction<EditForm>>
  openCats:        Set<string>
  setOpenCats:     React.Dispatch<React.SetStateAction<Set<string>>>
  confirmCancel:   boolean
  setConfirmCancel:(v: boolean) => void
  editOperators:   Operators
  services:        Services
  onSave:          () => Promise<void>
  onCancelEntry:   () => Promise<void>
}

export function EditOrderModal({
  editingEntry, onClose,
  editForm, setEditForm,
  openCats, setOpenCats,
  confirmCancel, setConfirmCancel,
  editOperators, services,
  onSave, onCancelEntry,
}: EditOrderModalProps) {
  const vehicle  = editingEntry.vehicle
  const vType    = vehicle?.type ?? 'automovil'
  const allItems = editingEntry.order?.items ?? []
  const canEdit          = editingEntry.status === 'esperando' || editingEntry.status === 'en_proceso'
  const hasConfirmedItems = allItems.some(i => i.is_confirmed)
  const abono            = Number(editingEntry.order?.downpayment ?? 0)

  function getStdPrice(svcId: number): number {
    const svc = services.find(s => s.id === svcId)
    if (!svc) return 0
    return vType === 'camion_estandar'
      ? Number(svc.price_camion_estandar ?? svc.price_automovil)
      : vType === 'camion_xl'
      ? Number(svc.price_camion_xl ?? svc.price_automovil)
      : Number(svc.price_automovil)
  }

  function getEffective(svcId: number): number {
    const custom = editForm.customPrices[svcId]
    if (custom != null && custom !== '') return Number(parseCOP(custom))
    return getStdPrice(svcId)
  }

  const editTotal       = editForm.serviceIds.reduce((sum, id) => sum + getEffective(id), 0)
  const totalBelowAbono = abono > 0 && editTotal < abono

  // Operator types needed for currently selected services (excluding third-party types)
  const neededOpTypes = [...new Set(editForm.serviceIds.map(id => {
    const svc = services.find(s => s.id === id)
    const cat = svc?.category ?? allItems.find(i => i.service_id === id)?.service_category
    return cat ? CAT_TO_OP_TYPE[cat] ?? 'detallado' : 'detallado'
  }).filter(t => !NO_OPERATOR_TYPES.has(t)))]

  const cantSave = totalBelowAbono

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
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">Editar Orden</h3>
            <p className="text-xs text-gray-500 mt-0.5">{vehicle?.plate} · {vehicle?.brand} {vehicle?.model}</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Operator selectors per type ── */}
          {canEdit && neededOpTypes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Operarios asignados</p>
                {hasConfirmedItems && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                    ✓ Listo para liquidar
                  </span>
                )}
              </div>
              {neededOpTypes.map(opType => {
                const candidates = editOperators.filter(o => (o.operator_type ?? 'detallado') === opType)
                const selected   = editForm.operatorByType[opType] ?? ''
                const isSingle   = candidates.length === 1
                const selectedOp = candidates.find(o => String(o.id) === String(selected))
                return (
                  <div key={opType} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 space-y-1">
                    <p className="text-xs font-medium text-gray-400">{OP_TYPE_LABEL[opType] ?? opType}</p>
                    {hasConfirmedItems ? (
                      /* Operator locked — confirmed items are already in liquidation */
                      <p className="text-sm text-gray-200">
                        {isSingle
                          ? candidates[0].name
                          : selectedOp?.name ?? <span className="text-gray-500 italic">Sin asignar</span>}
                      </p>
                    ) : isSingle ? (
                      <p className="text-sm text-gray-200">{candidates[0].name}</p>
                    ) : candidates.length === 0 ? (
                      <p className="text-xs text-red-400 italic">No hay operarios de este tipo</p>
                    ) : (
                      <select
                        value={selected}
                        onChange={e => setEditForm(f => ({
                          ...f,
                          operatorByType: { ...f.operatorByType, [opType]: e.target.value },
                        }))}
                        style={{ colorScheme: 'dark' }}
                        className="w-full rounded-lg border border-white/10 bg-gray-800 px-2.5 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/20 appearance-none"
                      >
                        <option value="">Seleccionar...</option>
                        {candidates.map(op => (
                          <option key={op.id} value={op.id} className="bg-gray-800">{op.name}</option>
                        ))}
                      </select>
                    )}
                    {!hasConfirmedItems && !selected && candidates.length > 1 && (
                      <p className="text-[10px] text-gray-500">Opcional — se asigna al entregar</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Selected services ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-300">
                Servicios
                <span className="ml-2 text-xs text-gray-600">({editForm.serviceIds.length})</span>
              </p>
              <div className="text-right">
                <span className={cn('text-base font-bold', totalBelowAbono ? 'text-red-400' : 'text-yellow-400')}>
                  ${editTotal.toLocaleString('es-CO')}
                </span>
                {abono > 0 && (
                  <p className={cn('text-[10px]', totalBelowAbono ? 'text-red-400' : 'text-gray-500')}>
                    Abono: ${abono.toLocaleString('es-CO')}
                    {totalBelowAbono && ' — total menor al abono'}
                  </p>
                )}
              </div>
            </div>

            {editForm.serviceIds.length === 0 ? (
              <p className="text-xs text-gray-600 italic px-1">Sin servicios seleccionados.</p>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {editForm.serviceIds.map(svcId => {
                    const label    = allItems.find(i => i.service_id === svcId)?.service_name
                      ?? services.find(s => s.id === svcId)?.name
                      ?? `Servicio ${svcId}`
                    const stdPrice = getStdPrice(svcId)
                    const effPrice = getEffective(svcId)
                    const hasCustom = editForm.customPrices[svcId] != null
                      && editForm.customPrices[svcId] !== ''
                      && effPrice !== stdPrice
                    const svcCat = services.find(s => s.id === svcId)?.category
                      ?? allItems.find(i => i.service_id === svcId)?.service_category

                    return (
                      <motion.div
                        key={svcId}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-gray-200 truncate">{label}</p>
                              {hasCustom && (
                                <p className="text-[10px] text-gray-600 line-through">${stdPrice.toLocaleString('es-CO')}</p>
                              )}
                            </div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setEditForm(f => {
                                  const next = { ...f, serviceIds: f.serviceIds.filter(id => id !== svcId) }
                                  const cp = { ...next.customPrices }; delete cp[svcId]; next.customPrices = cp
                                  const lp = { ...next.latOperatorPays }; delete lp[svcId]; next.latOperatorPays = lp
                                  return next
                                })}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                                title="Eliminar servicio"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Price input */}
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 shrink-0">$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editForm.customPrices[svcId] != null
                                  ? fmtCOP(editForm.customPrices[svcId])
                                  : fmtCOP(String(stdPrice))}
                                onChange={e => {
                                  const raw = parseCOP(e.target.value)
                                  setEditForm(f => ({ ...f, customPrices: { ...f.customPrices, [svcId]: raw } }))
                                }}
                                onWheel={e => e.currentTarget.blur()}
                                className="flex-1 rounded-lg border border-white/10 bg-gray-800 px-2 py-1 text-sm text-gray-100 text-right focus:border-yellow-500/40 focus:outline-none focus:ring-1 focus:ring-yellow-500/20"
                              />
                            </div>
                          )}

                          {/* Latonería operator pay per service */}
                          {canEdit && svcCat === 'latoneria' && (() => {
                            const latVal = editForm.latOperatorPays[svcId] ?? ''
                            return (
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-blue-400">
                                  Pago al latonero
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 shrink-0">$</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={latVal ? fmtCOP(latVal) : ''}
                                    onChange={e => {
                                      const raw    = parseCOP(e.target.value)
                                      const capped = raw ? String(Math.min(Number(raw), effPrice)) : ''
                                      setEditForm(f => ({ ...f, latOperatorPays: { ...f.latOperatorPays, [svcId]: capped } }))
                                    }}
                                    onWheel={e => e.currentTarget.blur()}
                                    className="flex-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-sm text-gray-100 text-right focus:outline-none focus:ring-1 focus:border-blue-500/50 focus:ring-blue-500/20"
                                  />
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── Add services accordion ── */}
          {canEdit && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Agregar servicios</p>
              {CATEGORY_ORDER.map(cat => {
                const catServices  = services.filter(s => s.category === cat && s.active)
                if (catServices.length === 0) return null
                const isOpen       = openCats.has(cat)
                const addableCount = catServices.filter(s => !editForm.serviceIds.includes(s.id)).length
                if (addableCount === 0) return null
                return (
                  <div key={cat} className="rounded-xl border border-white/8 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenCats(prev => {
                        const next = new Set(prev)
                        next.has(cat) ? next.delete(cat) : next.add(cat)
                        return next
                      })}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-200">{CATEGORY_LABELS[cat]}</span>
                      <ChevronDown size={14} className={cn('text-gray-500 transition-transform duration-200', isOpen && 'rotate-180')} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-2 py-1.5 space-y-0.5 max-h-44 overflow-y-auto">
                            {catServices
                              .filter(s => !editForm.serviceIds.includes(s.id))
                              .map(svc => (
                                <button
                                  key={svc.id}
                                  type="button"
                                  onClick={() => setEditForm(f => {
                                    const next   = { ...f, serviceIds: [...f.serviceIds, svc.id] }
                                    const opType = CAT_TO_OP_TYPE[svc.category] ?? 'detallado'
                                    if (!next.operatorByType[opType]) {
                                      const cands = editOperators.filter(o => (o.operator_type ?? 'detallado') === opType)
                                      if (cands.length === 1) {
                                        next.operatorByType = { ...next.operatorByType, [opType]: String(cands[0].id) }
                                      }
                                    }
                                    return next
                                  })}
                                  className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors text-left"
                                >
                                  <span className="text-sm text-gray-300">{svc.name}</span>
                                  <span className="text-xs text-gray-500">
                                    +${getStdPrice(svc.id).toLocaleString('es-CO')}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — save / cancel confirmation */}
        <div className="p-5 pt-4 border-t border-white/8 shrink-0">
          <AnimatePresence mode="wait">
            {confirmCancel ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                <p className="text-sm text-center text-gray-300">
                  Se eliminarán todos los servicios y el vehículo saldrá del patio.{' '}
                  <span className="text-white font-medium">¿Está seguro?</span>
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => setConfirmCancel(false)}>
                    No, volver
                  </Button>
                  <Button variant="destructive" size="lg" className="flex-1" onClick={onCancelEntry}>
                    Sí, cancelar
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {cantSave && (
                  <p className="text-[11px] text-center text-red-400">
                    El total no puede ser menor al abono del cliente
                  </p>
                )}
                <div className="flex gap-3">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="lg" className="flex-1" onClick={onSave} disabled={cantSave}>
                    Guardar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
