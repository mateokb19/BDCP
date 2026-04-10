import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ArrowRight, Wrench, Pencil, Calendar, Phone, User, Banknote, CreditCard, Check, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { VehicleTypeIcon } from '@/app/components/ui/VehicleTypeIcon'
import { cn } from '@/app/components/ui/cn'
import { api } from '@/api'
import type { PatioStatus } from '@/types'
import type { PatioCardProps } from './types'
import { useElapsed } from './useElapsed'
import { NEXT_STATUS, NEXT_LABEL, DELIVERY_HOURS } from './constants'
import { _today } from './utils'

export function PatioCard({ entry, opName, facturaRecord, onAdvance, onEdit, onUpdate }: PatioCardProps) {
  const elapsed  = useElapsed(entry.started_at ?? entry.entered_at)
  const next     = NEXT_STATUS[entry.status as PatioStatus]
  const vehicle  = entry.vehicle
  const items    = entry.order?.items ?? []
  const client   = vehicle?.client

  const [expanded,        setExpanded]        = useState(false)
  const [editingDelivery, setEditingDelivery] = useState(false)
  const [draftDate,       setDraftDate]       = useState('')
  const [draftHour,       setDraftHour]       = useState('')
  const [savingDelivery,  setSavingDelivery]  = useState(false)

  // ── Service checklist (en_proceso only) ─────────────────────────────────────
  const showChecklist = entry.status === 'en_proceso' && items.length > 0
  const [checkedIds, setCheckedIds] = useState<number[]>(() =>
    items.filter(i => i.is_confirmed).map(i => i.id)
  )
  const checkedCount = showChecklist ? checkedIds.filter(id => items.some(i => i.id === id)).length : 0
  const allChecked   = showChecklist && checkedCount === items.length && items.length > 0

  async function toggleServiceCheck(itemId: number, e: React.MouseEvent) {
    e.stopPropagation()
    const nextIds = checkedIds.includes(itemId)
      ? checkedIds.filter(id => id !== itemId)
      : [...checkedIds, itemId]
    setCheckedIds(nextIds)
    // Auto-advance when all checked
    const validCount = nextIds.filter(id => items.some(i => i.id === id)).length
    if (validCount === items.length && items.length > 0) {
      setTimeout(() => onAdvance(entry), 400)
    }
    try {
      const updated = await api.patio.confirmItem(entry.id, itemId)
      onUpdate(updated)
      setCheckedIds((updated.order?.items ?? []).filter(i => i.is_confirmed).map(i => i.id))
    } catch {
      setCheckedIds(checkedIds)
    }
  }

  function openDeliveryEdit(e: React.MouseEvent) {
    e.stopPropagation()
    if (entry.scheduled_delivery_at) {
      const dt = new Date(entry.scheduled_delivery_at)
      const y  = dt.getFullYear()
      const mo = String(dt.getMonth() + 1).padStart(2, '0')
      const d  = String(dt.getDate()).padStart(2, '0')
      setDraftDate(`${y}-${mo}-${d}`)
      setDraftHour(`${String(dt.getHours()).padStart(2, '0')}:00`)
    } else {
      setDraftDate(_today())
      setDraftHour('08:00')
    }
    setEditingDelivery(true)
  }

  async function saveDelivery(e: React.MouseEvent) {
    e.stopPropagation()
    setSavingDelivery(true)
    try {
      const iso     = draftDate ? `${draftDate}T${draftHour || '08:00'}:00` : null
      const updated = await api.patio.edit(entry.id, { scheduled_delivery_at: iso })
      onUpdate(updated)
      setEditingDelivery(false)
    } catch {
      toast.error('No se pudo actualizar la fecha')
    } finally {
      setSavingDelivery(false)
    }
  }

  const total    = Number(entry.order?.total ?? 0)
  const abono    = Number(entry.order?.downpayment ?? 0)
  const restante = Math.max(0, total - abono)

  return (
    <motion.div
      layout
      layoutId={`patio-${entry.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden"
    >
      {/* ── Clickable summary ─────────────────────────────────────────────────── */}
      <div
        className="p-4 space-y-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Vehicle */}
        <div className="flex items-center gap-2.5">
          {vehicle && (
            <div className="rounded-xl bg-white/8 p-2 shrink-0">
              <VehicleTypeIcon type={vehicle.type as any} size={18} className="text-gray-300" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {vehicle?.brand ?? '—'} {vehicle?.model}
            </div>
            <div className="text-xs text-gray-500">
              {vehicle?.plate ?? '—'}{vehicle?.color ? ` · ${vehicle.color}` : ''}
            </div>
          </div>
          <div className="ml-auto shrink-0 flex items-center gap-1.5">
            {entry.notes && (
              <span className="flex items-center rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-semibold text-orange-400 leading-none">
                ⚠
              </span>
            )}
            {facturaRecord && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-400 leading-none">
                <svg viewBox="0 0 14 14" className="w-3 h-3 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 1.5A1.5 1.5 0 013.5 0h7A1.5 1.5 0 0112 1.5v11a.5.5 0 01-.757.429L7 10.697l-4.243 2.232A.5.5 0 012 12.5v-11zM3.5 1a.5.5 0 00-.5.5v10.303l3.743-1.97a.5.5 0 01.514 0L11 11.803V1.5a.5.5 0 00-.5-.5h-7z"/>
                </svg>
                FE
              </span>
            )}
            {expanded
              ? <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
              : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            }
          </div>
        </div>

        {/* Operator */}
        <div className="flex items-center gap-1.5 text-xs">
          <Wrench size={11} className="text-gray-600 shrink-0" />
          {opName
            ? <span className="text-gray-400">{opName}</span>
            : <span className="text-orange-500/70 italic">Sin operario</span>
          }
        </div>

        {/* Service progress bar (en_proceso) */}
        {showChecklist && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', allChecked ? 'bg-green-500' : 'bg-yellow-500/80')}
                initial={false}
                animate={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : '0%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>
            <span className={cn('text-[10px] font-medium tabular-nums shrink-0', allChecked ? 'text-green-400' : 'text-gray-500')}>
              {checkedCount}/{items.length}
            </span>
          </div>
        )}

        {/* Delivery date + inline edit pencil */}
        <div className="flex items-center justify-between gap-2">
          {entry.scheduled_delivery_at ? (
            <div className="flex items-center gap-1.5 text-xs text-blue-400/80">
              <Calendar size={11} className="shrink-0" />
              <span>
                Entrega: {new Date(entry.scheduled_delivery_at).toLocaleString('es-CO', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-700 italic">Sin fecha de entrega</span>
          )}
          {entry.status !== 'entregado' && (
            <button
              type="button"
              onClick={openDeliveryEdit}
              className="shrink-0 rounded-lg p-1 text-gray-600 hover:text-blue-400 hover:bg-white/[0.06] transition-colors"
              title="Editar fecha de entrega"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Checklist — always visible when en_proceso ────────────────────────── */}
      {showChecklist && (
        <div
          className="px-4 pb-3 border-t border-white/6 space-y-1 pt-2.5"
          onClick={e => e.stopPropagation()}
        >
          {entry.order?.is_warranty && (
            <Badge variant="orange" className="text-[10px] py-0.5 mb-1 block w-fit">Garantía</Badge>
          )}
          {items.map(item => {
            const done = checkedIds.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={e => toggleServiceCheck(item.id, e)}
                className={cn(
                  'flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-left transition-colors',
                  done
                    ? 'bg-green-500/10 border border-green-500/25'
                    : 'bg-white/[0.03] border border-white/6 active:bg-white/[0.06]'
                )}
              >
                {done
                  ? <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  : <Circle size={14} className="text-gray-600 shrink-0" />
                }
                <span className={cn(
                  'text-xs leading-tight',
                  done ? 'text-green-300 line-through decoration-green-500/40' : 'text-gray-300'
                )}>
                  {item.service_name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Inline delivery date editor ───────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {editingDelivery && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-3 border-t border-white/6 bg-blue-500/[0.04] space-y-2.5"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-xs font-medium text-blue-300">Fecha de entrega acordada</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={draftDate}
                  min={_today()}
                  onChange={e => setDraftDate(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="flex-1 min-w-[140px] rounded-xl border border-blue-500/30 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:invert"
                />
                <select
                  value={draftHour}
                  onChange={e => setDraftHour(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="w-24 rounded-xl border border-blue-500/30 bg-gray-900 px-2 py-2 text-sm text-gray-100 focus:border-blue-500/60 focus:outline-none appearance-none text-center"
                >
                  {DELIVERY_HOURS.map(h => {
                    const val = `${String(h).padStart(2, '0')}:00`
                    return <option key={h} value={val} className="bg-gray-900">{val}</option>
                  })}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setEditingDelivery(false) }}
                  className="flex-1 rounded-xl border border-white/10 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveDelivery}
                  disabled={savingDelivery || !draftDate}
                  className="flex-1 rounded-xl bg-blue-500/20 border border-blue-500/40 py-1.5 text-xs text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={12} />
                  {savingDelivery ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded detail ───────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-white/6 pt-3">

              {/* Client */}
              {client && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <User size={11} className="text-gray-600 shrink-0" />
                    <span>{client.name}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={11} className="text-gray-600 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Damage notes */}
              {entry.notes && (
                <div className="flex gap-2 rounded-xl bg-orange-500/8 border border-orange-500/20 px-3 py-2">
                  <span className="text-orange-400 text-xs shrink-0 font-medium mt-0.5">⚠</span>
                  <p className="text-xs text-orange-300 leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
                </div>
              )}

              {/* Service badges — shown in expanded view when not in checklist mode */}
              {items.length > 0 && !showChecklist && (
                <div className="flex flex-wrap gap-1">
                  {entry.order?.is_warranty && (
                    <Badge variant="orange" className="text-[10px] py-0.5">Garantía</Badge>
                  )}
                  {items.map(item => (
                    <Badge key={item.id} variant="default" className="text-[10px] py-0.5">
                      {item.service_name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Financial summary */}
              {entry.order && (
                <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2 space-y-1">
                  {abono > 0 ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Total</span>
                        <span className="text-gray-300">${total.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Abono</span>
                        <span className="text-green-400">${abono.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold border-t border-white/6 pt-1 mt-1">
                        <span className="text-gray-400">Resta</span>
                        <span className="text-orange-400">${restante.toLocaleString('es-CO')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Total</span>
                      <span className="text-yellow-400">${total.toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  {/* Payment method breakdown (after delivery) */}
                  {entry.status === 'entregado' && (() => {
                    const pm = [
                      { key: 'payment_cash',        label: 'Efectivo',    icon: <Banknote size={10} /> },
                      { key: 'payment_datafono',    label: 'Datáfono',    icon: <CreditCard size={10} /> },
                      { key: 'payment_nequi',       label: 'Nequi',       icon: <CreditCard size={10} /> },
                      { key: 'payment_bancolombia', label: 'Bancolombia', icon: <CreditCard size={10} /> },
                    ] as const
                    const paid = pm.filter(p => Number((entry.order as any)[p.key]) > 0)
                    if (paid.length === 0) return null
                    return (
                      <div className="border-t border-white/6 pt-1 mt-1 space-y-0.5">
                        {paid.map(p => (
                          <div key={p.key} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-gray-500">{p.icon} {p.label}</span>
                            <span className="text-gray-300">${Number((entry.order as any)[p.key]).toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Facturación electrónica detail */}
              {facturaRecord && (
                <div className="rounded-xl bg-blue-500/[0.07] border border-blue-500/25 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 14 14" className="w-3 h-3 fill-current text-blue-400 shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 1.5A1.5 1.5 0 013.5 0h7A1.5 1.5 0 0112 1.5v11a.5.5 0 01-.757.429L7 10.697l-4.243 2.232A.5.5 0 012 12.5v-11zM3.5 1a.5.5 0 00-.5.5v10.303l3.743-1.97a.5.5 0 01.514 0L11 11.803V1.5a.5.5 0 00-.5-.5h-7z"/>
                    </svg>
                    <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Facturación Electrónica</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Tipo</span>
                      <span className="text-gray-300">{facturaRecord.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{facturaRecord.id_type}{facturaRecord.dv ? ` · Dv ${facturaRecord.dv}` : ''}</span>
                      <span className="text-gray-300">{facturaRecord.id_number}</span>
                    </div>
                    {facturaRecord.email && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Correo</span>
                        <span className="text-blue-300 truncate max-w-[140px]">{facturaRecord.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit order button */}
              {entry.status !== 'entregado' && (
                <button
                  onClick={e => { e.stopPropagation(); onEdit(entry) }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors"
                >
                  <Pencil size={12} /> Editar orden
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer: elapsed time + advance button ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} />
          <span>{elapsed}</span>
        </div>
        {next && entry.status !== 'en_proceso' && (
          <Button variant="outline" size="sm" onClick={() => onAdvance(entry)}
            className="text-xs py-1 h-7 shrink-0">
            {NEXT_LABEL[entry.status as PatioStatus]}
            <svg viewBox="0 0 24 24" className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Button>
        )}
      </div>
    </motion.div>
  )
}
