import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Clock, ArrowRight, Wrench, Pencil, X, ChevronDown, Calendar, Phone, User, ChevronUp, Banknote, CreditCard, Check, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { VehicleTypeIcon } from '@/app/components/ui/VehicleTypeIcon'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiPatioEntry } from '@/api'
import { Select } from '@/app/components/ui/Select'
import { useAppContext } from '@/app/context/AppContext'
import type { PatioStatus } from '@/types'

interface FacturaRecord {
  tipo:      'persona_natural' | 'empresa'
  id_type:   string
  id_number: string
  dv:        string
  name:      string
  phone:     string
  email:     string
}

const FACTURA_KEY = 'bdcpolo_facturas'

function loadFacturas(): Record<number, FacturaRecord> {
  try { return JSON.parse(localStorage.getItem(FACTURA_KEY) ?? '{}') } catch { return {} }
}

// ── Service checklist helpers (localStorage) ────────────────────────────────
const CHECKLIST_KEY = 'bdcpolo_service_checklist'
function loadChecklist(): Record<number, number[]> {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '{}') } catch { return {} }
}
function saveChecklist(data: Record<number, number[]>) {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data))
}

// ── Currency helpers ─────────────────────────────────────────────────────────
const parseCOP = (s: string) => s.replace(/\D/g, '')
const fmtCOP   = (raw: string | number): string => {
  const str = typeof raw === 'number' ? String(raw) : raw
  const n   = Number(parseCOP(str))
  return str === '' || isNaN(n) ? '' : n.toLocaleString('es-CO')
}

const COLUMNS: { status: PatioStatus; label: string; color: string; border: string; dot: string }[] = [
  { status: 'esperando',  label: 'Esperando',  color: 'text-orange-400', border: 'border-t-orange-500/60', dot: 'bg-orange-500' },
  { status: 'en_proceso', label: 'En Proceso', color: 'text-blue-400',   border: 'border-t-blue-500/60',   dot: 'bg-blue-500'   },
  { status: 'listo',      label: 'Listo',      color: 'text-green-400',  border: 'border-t-green-500/60',  dot: 'bg-green-500'  },
  { status: 'entregado',  label: 'Entregado',  color: 'text-gray-400',   border: 'border-t-gray-500/60',   dot: 'bg-gray-500'   },
]

const NEXT_STATUS: Record<PatioStatus, PatioStatus | null> = {
  esperando:  'en_proceso',
  en_proceso: 'listo',
  listo:      'entregado',
  entregado:  null,
}
const NEXT_LABEL: Record<PatioStatus, string> = {
  esperando:  'Iniciar',
  en_proceso: 'Completar',
  listo:      'Entregar',
  entregado:  'Entregado',
}

function useElapsed(startISO?: string): string {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!startISO) { setElapsed('—'); return }
    function update() {
      const diff = Date.now() - new Date(startISO!).getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [startISO])
  return elapsed
}

const DELIVERY_HOURS = Array.from({ length: 10 }, (_, i) => i + 8)
const _today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface PatioCardProps {
  entry:          ApiPatioEntry
  opName?:        string
  facturaRecord?: FacturaRecord
  onAdvance:      (entry: ApiPatioEntry) => void
  onEdit:         (entry: ApiPatioEntry) => void
  onUpdate:       (updated: ApiPatioEntry) => void
}

function PatioCard({ entry, opName, facturaRecord, onAdvance, onEdit, onUpdate }: PatioCardProps) {
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

  // ── Service checklist (en_proceso only) ────────────────
  const showChecklist = entry.status === 'en_proceso' && items.length > 0
  const [checkedIds, setCheckedIds] = useState<number[]>(() =>
    items.filter(i => i.is_confirmed).map(i => i.id)
  )
  const checkedCount = showChecklist ? checkedIds.filter(id => items.some(i => i.id === id)).length : 0
  const allChecked = showChecklist && checkedCount === items.length && items.length > 0

  async function toggleServiceCheck(itemId: number, e: React.MouseEvent) {
    e.stopPropagation()
    // Optimistic UI update
    const nextIds = checkedIds.includes(itemId)
      ? checkedIds.filter(id => id !== itemId)
      : [...checkedIds, itemId]
    setCheckedIds(nextIds)
    // Auto-advance when all checked
    const validCount = nextIds.filter(id => items.some(i => i.id === id)).length
    if (validCount === items.length && items.length > 0) {
      setTimeout(() => onAdvance(entry), 400)
    }
    // Persist to backend
    try {
      const updated = await api.patio.confirmItem(entry.id, itemId)
      onUpdate(updated)
      // Sync state from server response
      setCheckedIds((updated.order?.items ?? []).filter(i => i.is_confirmed).map(i => i.id))
    } catch {
      // Revert optimistic update on error
      setCheckedIds(checkedIds)
    }
  }

  function openDeliveryEdit(e: React.MouseEvent) {
    e.stopPropagation()
    if (entry.scheduled_delivery_at) {
      const dt = new Date(entry.scheduled_delivery_at)
      const y  = dt.getFullYear()
      const mo = String(dt.getMonth()+1).padStart(2,'0')
      const d  = String(dt.getDate()).padStart(2,'0')
      setDraftDate(`${y}-${mo}-${d}`)
      setDraftHour(`${String(dt.getHours()).padStart(2,'0')}:00`)
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
      const iso = draftDate ? `${draftDate}T${draftHour || '08:00'}:00` : null
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
      {/* ── Clickable summary ─────────────────────────────── */}
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
            {expanded ? (
              <ChevronUp size={14} className="text-gray-600" />
            ) : (
              <ChevronDown size={14} className="text-gray-600" />
            )}
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

        {/* Service progress (en_proceso) */}
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

        {/* Delivery date + edit icon */}
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

      {/* ── Checklist — always visible when en_proceso ──────── */}
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

      {/* ── Inline delivery date editor ───────────────────── */}
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
                    const val = `${String(h).padStart(2,'0')}:00`
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

      {/* ── Expanded detail ───────────────────────────────── */}
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

              {/* Services — badges in expanded view (checklist shown above the fold) */}
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

              {/* Financial */}
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
                  {/* Payment breakdown (shown after delivery) */}
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

              {/* Edit button */}
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

      {/* ── Footer: elapsed + advance ─────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} />
          <span>{elapsed}</span>
        </div>
        {next && entry.status !== 'en_proceso' && (
          <Button variant="outline" size="sm" onClick={() => onAdvance(entry)}
            className="text-xs py-1 h-7 shrink-0">
            {NEXT_LABEL[entry.status as PatioStatus]} <ArrowRight size={12} />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  exterior:           'Exterior',
  interior:           'Interior',
  ceramico:           'Cerámico',
  correccion_pintura: 'Corrección de Pintura',
  latoneria:          'Latonería',
  pintura:            'Pintura',
  ppf:                'PPF',
  polarizado:         'Polarizado',
}
const CATEGORY_ORDER: string[] = ['exterior', 'interior', 'correccion_pintura', 'ceramico', 'latoneria', 'pintura', 'ppf', 'polarizado']
// Maps service category → operator_type
const CAT_TO_OP_TYPE: Record<string, string> = {
  exterior: 'detallado', interior: 'detallado', ceramico: 'detallado', correccion_pintura: 'detallado',
  pintura: 'pintura', latoneria: 'latoneria', ppf: 'ppf', polarizado: 'polarizado', otro: 'otro',
}
const OP_TYPE_LABEL: Record<string, string> = {
  detallado: 'Detallado', pintura: 'Pintura', latoneria: 'Latonería', ppf: 'PPF', polarizado: 'Polarizado',
}
// Operator types that do NOT need an internal operator assigned (handled as third-party payments)
const NO_OPERATOR_TYPES = new Set(['ppf', 'polarizado', 'otro'])

export default function EstadoPatio() {
  const { operators, services } = useAppContext()
  const [entries,        setEntries]        = useState<ApiPatioEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [facturaRecords, setFacturaRecords] = useState<Record<number, FacturaRecord>>(loadFacturas)

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<ApiPatioEntry | null>(null)
  const [editForm, setEditForm] = useState({
    serviceIds: [] as number[],
    customPrices: {} as Record<number, string>,
    operatorByType: {} as Record<string, string>,   // operator_type → operator_id
  })
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editOperators, setEditOperators] = useState<typeof operators>([])

  // Operator picker modal state
  const [operatorPickEntry, setOperatorPickEntry] = useState<ApiPatioEntry | null>(null)
  const [pickedOpId, setPickedOpId]               = useState('')
  const [entryNotes, setEntryNotes]               = useState('')
  const [picking, setPicking]                     = useState(false)
  const [activeOperators, setActiveOperators]     = useState(operators.filter(o => (o.operator_type ?? 'detallado') === 'detallado'))

  // Payment modal state (delivery)
  const [paymentEntry, setPaymentEntry] = useState<ApiPatioEntry | null>(null)
  const [payMethods,   setPayMethods]   = useState<Record<string, string>>({})
  const [latPay,       setLatPay]       = useState('')
  const [delivering,   setDelivering]   = useState(false)
  const [applyIva,     setApplyIva]     = useState(false)
  const [factura,      setFactura]      = useState(false)
  const [facturaData,  setFacturaData]  = useState({
    tipo:      'persona_natural' as 'persona_natural' | 'empresa',
    id_type:   'CC',
    id_number: '',
    dv:        '',
    name:      '',
    phone:     '',
    email:     '',
  })

  function togglePayMethod(key: string) {
    setPayMethods(prev => {
      const next = { ...prev }
      if (key in next) {
        delete next[key]
      } else {
        next[key] = ''
      }
      return next
    })
  }

  useEffect(() => {
    api.patio.list()
      .then(setEntries)
      .catch(err => toast.error(err.message ?? 'Error al cargar el patio'))
      .finally(() => setLoading(false))
  }, [])

  // Re-fetch at midnight to drop yesterday's delivered entries from view
  useEffect(() => {
    let currentDate = new Date().toDateString()
    const interval = setInterval(() => {
      const now = new Date().toDateString()
      if (now !== currentDate) {
        currentDate = now
        api.patio.list().then(setEntries).catch(() => {})
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  async function openEdit(entry: ApiPatioEntry) {
    const items = entry.order?.items ?? []
    const selectedIds = items.map(i => i.service_id).filter((id): id is number => id != null)
    // Pre-fill custom prices from existing item prices
    const prices: Record<number, string> = {}
    items.forEach(i => { if (i.service_id != null) prices[i.service_id] = String(Number(i.unit_price)) })

    // Fetch fresh active operators for the selector
    const allOps = await api.operators.list().catch(() => [] as typeof operators)
    const activeOps = allOps.filter(o => o.active !== false)
    setEditOperators(activeOps)

    // Pre-fill operator by type: current operator_id → find its type
    const opByType: Record<string, string> = {}
    if (entry.order?.operator_id) {
      const currentOp = activeOps.find(o => o.id === entry.order!.operator_id)
      if (currentOp) {
        opByType[currentOp.operator_type ?? 'detallado'] = String(currentOp.id)
      }
    }
    // Auto-assign types with a single operator
    const opTypes = new Set(selectedIds.map(id => {
      const svc = services.find(s => s.id === id)
      const cat = svc?.category ?? items.find(i => i.service_id === id)?.service_category
      return cat ? CAT_TO_OP_TYPE[cat] : null
    }).filter(Boolean) as string[])
    for (const t of opTypes) {
      if (!opByType[t]) {
        const candidates = activeOps.filter(o => (o.operator_type ?? 'detallado') === t)
        if (candidates.length === 1) opByType[t] = String(candidates[0].id)
      }
    }

    setEditForm({ serviceIds: selectedIds, customPrices: prices, operatorByType: opByType })
    setOpenCats(new Set())
    setConfirmCancel(false)
    setEditingEntry(entry)
  }

  async function saveEdit() {
    if (!editingEntry) return
    const canEdit = editingEntry.status === 'esperando' || editingEntry.status === 'en_proceso'
    if (canEdit && editForm.serviceIds.length === 0) {
      setConfirmCancel(true)
      return
    }

    // Determine which operator types are needed
    const requiredTypes = new Set<string>()
    for (const id of editForm.serviceIds) {
      const svc = services.find(s => s.id === id)
      const cat = svc?.category ?? editingEntry.order?.items.find(i => i.service_id === id)?.service_category
      if (!cat) continue
      const opType = CAT_TO_OP_TYPE[cat] ?? 'detallado'
      if (!NO_OPERATOR_TYPES.has(opType)) requiredTypes.add(opType)
    }
    // Validate all required types have an operator
    for (const t of requiredTypes) {
      if (!editForm.operatorByType[t]) {
        toast.error(`Selecciona un operario de ${OP_TYPE_LABEL[t] ?? t}`)
        return
      }
    }

    try {
      // Build item_overrides for any custom prices
      const overrides = editForm.serviceIds
        .filter(id => editForm.customPrices[id] != null)
        .map(id => ({ service_id: id, unit_price: Number(parseCOP(editForm.customPrices[id])) }))

      const payload: Parameters<typeof api.patio.edit>[1] = {}
      if (canEdit) {
        payload.service_ids = editForm.serviceIds
        if (overrides.length > 0) payload.item_overrides = overrides
      }

      // Resolve which operator to save as order.operator_id
      // Priority: detallado > first type with an assigned operator
      const detOpId = editForm.operatorByType['detallado']
      const fallbackOpId = Object.values(editForm.operatorByType).find(v => v)
      const newOpId = detOpId ? Number(detOpId) : fallbackOpId ? Number(fallbackOpId) : null
      const currentOpId = editingEntry.order?.operator_id ?? null
      if (newOpId !== currentOpId) {
        payload.operator_id = newOpId
      }

      const updated = await api.patio.edit(editingEntry.id, payload)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      toast.success('Orden actualizada correctamente')
      setEditingEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function confirmCancelEntry() {
    if (!editingEntry) return
    try {
      await api.patio.cancel(editingEntry.id)
      setEntries(prev => prev.filter(e => e.id !== editingEntry.id))
      toast.success(`${editingEntry.vehicle?.plate ?? 'Vehículo'} cancelado y retirado del patio`)
      setEditingEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar')
    }
  }

  async function advanceStatus(entry: ApiPatioEntry) {
    if (entry.status === 'esperando' && !entry.order?.operator_id) {
      const items = entry.order?.items ?? []
      const categories = items.map(i => i.service_category)

      // Collect all required operator types from the order's service categories (exclude third-party types)
      const requiredTypes = [...new Set(categories.map(c => CAT_TO_OP_TYPE[c] ?? 'detallado').filter(t => !NO_OPERATOR_TYPES.has(t)))]

      // Fetch fresh active operators
      const allOps = await api.operators.list().catch(() => [] as typeof operators)
      const activeOps = allOps.filter(o => o.active !== false)

      // Map each required type to its candidates
      const typeToOps: Record<string, typeof activeOps> = {}
      for (const t of requiredTypes) {
        typeToOps[t] = activeOps.filter(o => (o.operator_type ?? 'detallado') === t)
      }

      // No internal operator needed (only third-party services like ppf/polarizado) — advance directly
      if (requiredTypes.length === 0) {
        try {
          const updated = await api.patio.advance(entry.id)
          setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
          toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → En Proceso`)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Error al iniciar proceso')
        }
        return
      }

      // If all required types have exactly 1 candidate, auto-assign without showing picker
      const allAutoAssignable = requiredTypes.every(t => typeToOps[t].length === 1)
      if (allAutoAssignable) {
        // operator_id: detallado takes priority, else first required type
        const detOp = typeToOps['detallado']?.[0]
        const assignOp = detOp ?? typeToOps[requiredTypes[0]]?.[0]
        if (assignOp) {
          try {
            await api.patio.edit(entry.id, { operator_id: assignOp.id })
            const updated = await api.patio.advance(entry.id)
            setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
            toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → En Proceso`)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al iniciar proceso')
          }
          return
        }
      }

      // Show picker (only for detallado — the only type that can have multiple candidates)
      const detallado = activeOps.filter(o => (o.operator_type ?? 'detallado') === 'detallado')
      setActiveOperators(detallado)
      setOperatorPickEntry(entry)
      setPickedOpId('')
      setEntryNotes(entry.notes ?? '')
      return
    }
    // Intercept delivery to collect payment info
    if (entry.status === 'listo') {
      if (entry.scheduled_delivery_at) {
        const scheduledDate = format(parseISO(entry.scheduled_delivery_at), 'dd/MM/yyyy')
        const today = format(new Date(), 'dd/MM/yyyy')
        if (scheduledDate !== today) {
          toast.warning(`Este vehículo estaba programado para entregarse el ${scheduledDate}`)
        }
      }
      setPaymentEntry(entry)
      setPayMethods({})
      setLatPay('')
      setApplyIva(false)
      const savedClient = entry.vehicle?.client
      const hasSavedFactura = !!(savedClient?.tipo_persona && savedClient?.identificacion)
      setFactura(hasSavedFactura)
      setFacturaData({
        tipo:      (savedClient?.tipo_persona as 'persona_natural' | 'empresa') ?? 'persona_natural',
        id_type:   savedClient?.tipo_identificacion ?? 'CC',
        id_number: savedClient?.identificacion ?? '',
        dv:        savedClient?.dv ?? '',
        name:      savedClient?.name  ?? '',
        phone:     savedClient?.phone ?? '',
        email:     savedClient?.email ?? '',
      })
      return
    }
    try {
      const updated = await api.patio.advance(entry.id)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      // Clean up checklist localStorage when leaving en_proceso
      if (entry.status === 'en_proceso') {
        const all = loadChecklist()
        delete all[entry.order_id]
        saveChecklist(all)
      }
      const label = COLUMNS.find(c => c.status === updated.status)?.label
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → ${label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar estado')
    }
  }

  async function confirmDelivery() {
    if (!paymentEntry) return
    const restante = Math.max(0, Number(paymentEntry.order?.total ?? 0) - Number(paymentEntry.order?.downpayment ?? 0))
    const DETALLADO_CATS = new Set(['exterior', 'interior', 'ceramico', 'correccion_pintura'])
    const nonDetailladoTotal = (paymentEntry.order?.items ?? [])
      .filter(i => !DETALLADO_CATS.has(i.service_category))
      .reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)
    const ivaAmt = Math.round(nonDetailladoTotal * 0.19)
    const effectiveRestante = applyIva ? restante + ivaAmt : restante
    const keyToField: Record<string, 'payment_cash' | 'payment_datafono' | 'payment_nequi' | 'payment_bancolombia'> = {
      cash:        'payment_cash',
      datafono:    'payment_datafono',
      nequi:       'payment_nequi',
      bancolombia: 'payment_bancolombia',
    }
    const payment = { payment_cash: 0, payment_datafono: 0, payment_nequi: 0, payment_bancolombia: 0 }
    const checkedKeys = Object.keys(payMethods)
    if (checkedKeys.length === 1) {
      payment[keyToField[checkedKeys[0]]] = effectiveRestante
    } else {
      for (const k of checkedKeys) {
        payment[keyToField[k]] = Number(payMethods[k]) || 0
      }
    }
    const hasLatoneria = (paymentEntry.order?.items ?? []).some(i => i.service_category === 'latoneria')
    const advancePayload: Parameters<typeof api.patio.advance>[1] = {
      ...payment,
      ...(hasLatoneria && latPay ? { latoneria_operator_pay: Number(parseCOP(latPay)) } : {}),
    }
    setDelivering(true)
    try {
      const updated = await api.patio.advance(paymentEntry.id, advancePayload)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      // Persist factura data keyed by order id (localStorage) and to client profile (API)
      if (factura && facturaData.id_number && paymentEntry.order?.id) {
        const next = { ...facturaRecords, [paymentEntry.order.id]: facturaData as FacturaRecord }
        setFacturaRecords(next)
        localStorage.setItem(FACTURA_KEY, JSON.stringify(next))
        const clientId = paymentEntry.vehicle?.client?.id
        if (clientId) {
          api.clients.patch(clientId, {
            tipo_persona:        facturaData.tipo,
            tipo_identificacion: facturaData.id_type,
            identificacion:      facturaData.id_number,
            dv:                  facturaData.dv || undefined,
            email:               facturaData.email || undefined,
          }).catch(() => {}) // non-blocking
        }
      }
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} entregado`)
      setPaymentEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al entregar')
    } finally {
      setDelivering(false)
    }
  }

  async function confirmAdvanceWithOperator() {
    if (!operatorPickEntry || !pickedOpId) return
    setPicking(true)
    try {
      await api.patio.edit(operatorPickEntry.id, { operator_id: Number(pickedOpId), notes: entryNotes || null })
      const updated = await api.patio.advance(operatorPickEntry.id)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → En Proceso`)
      setOperatorPickEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar proceso')
    } finally {
      setPicking(false)
    }
  }

  const stats = COLUMNS.map(col => ({
    ...col,
    count: entries.filter(e => e.status === col.status).length,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Cargando patio...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Estado de Patio"
        subtitle={`${entries.filter(e => e.status !== 'entregado').length} vehículos activos`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(col => (
          <div key={col.status} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 flex items-center gap-3">
            <div className={cn('w-2.5 h-2.5 rounded-full', col.dot)} />
            <div>
              <div className={cn('text-xl font-bold', col.color)}>{col.count}</div>
              <div className="text-xs text-gray-500">{col.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban + Minimap */}
      {(() => {
        const CAP = 15
        const active = entries.filter(e => e.status !== 'entregado').length
        const occ = Math.min(active, CAP)
        const ov  = Math.max(0, active - CAP)
        const cc  = active >= CAP ? 'text-red-400' : active >= 10 ? 'text-yellow-400' : 'text-green-400'
        const bc  = active >= CAP ? 'bg-red-500'  : active >= 10 ? 'bg-yellow-500'   : 'bg-green-500'
        const SP = [
          // Zona 1 — Pintura/Latonería (2 slots, divisor vertical central)
          { x: 25, y: 10 }, { x: 75, y: 10 },
          // Zona 2 — Lavado fila 1 (3 cols)
          { x: 17, y: 30 }, { x: 50, y: 30 }, { x: 83, y: 30 },
          // Zona 3 — Lavado fila 2 (3 cols)
          { x: 17, y: 50 }, { x: 50, y: 50 }, { x: 83, y: 50 },
          // Zona 4 — Detallado (3 anchos izq + 1 der)
          { x: 27, y: 64 }, { x: 27, y: 70 }, { x: 27, y: 76 }, { x: 75, y: 70 },
          // Cuarto inferior (2 anchos izq + 1 der)
          { x: 27, y: 86 }, { x: 27, y: 93 }, { x: 75, y: 89 },
        ]
        return (
          <div className="flex gap-4 items-start">
      <LayoutGroup>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colEntries = entries.filter(e => e.status === col.status)
            return (
              <div key={col.status} className={cn(
                'rounded-2xl border-t-2 bg-white/[0.015] border border-white/6 flex flex-col',
                col.border
              )}>
                <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', col.dot)} />
                    <span className={cn('text-sm font-medium', col.color)}>{col.label}</span>
                  </div>
                  <motion.span
                    key={colEntries.length}
                    initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                    className="text-xs font-semibold text-gray-500 bg-white/8 rounded-full px-2 py-0.5"
                  >
                    {colEntries.length}
                  </motion.span>
                </div>

                <div className="flex-1 p-3 space-y-3 min-h-[200px] relative">
                  <AnimatePresence mode="popLayout">
                    {colEntries.map(entry => {
                      const opName = entry.order?.operator_id
                        ? operators.find(o => o.id === entry.order!.operator_id)?.name
                        : undefined
                      return (
                        <PatioCard
                          key={entry.id}
                          entry={entry}
                          opName={opName}
                          facturaRecord={entry.order?.id != null ? facturaRecords[entry.order.id] : undefined}
                          onAdvance={advanceStatus}
                          onEdit={openEdit}
                          onUpdate={updated => setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))}
                        />
                      )
                    })}
                  </AnimatePresence>
                  <AnimatePresence>
                    {colEntries.length === 0 && (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.2 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <p className="text-xs text-gray-700">Sin vehículos</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      </LayoutGroup>

            {/* Minimap — sticky panel to the right of kanban, xl only */}
            <div className="hidden xl:flex flex-col gap-2 sticky top-4 shrink-0 rounded-2xl border border-white/8 bg-white/[0.03] p-3" style={{ width: 200 }}>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-gray-500">Bodega</span>
                <span className={cn('text-[10px] font-bold tabular-nums', cc)}>{active}/{CAP}</span>
                {ov > 0 && <span className="text-[9px] font-semibold bg-red-500/15 border border-red-500/30 text-red-400 rounded-full px-1 leading-none py-0.5">+{ov}</span>}
                <div className="flex-1 h-0.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div animate={{ width: `${Math.min(100, (active / CAP) * 100)}%` }} transition={{ duration: 0.5 }} className={cn('h-full rounded-full', bc)} />
                </div>
              </div>
              <div className="relative w-full rounded border border-white/10 bg-gray-950 overflow-hidden" style={{ height: 300 }}>
                {/* Divisor vertical zona superior (Pintura/Latonería) */}
                <div className="absolute top-0 border-r border-white/15" style={{ left: '50%', height: '20%' }} />
                {/* Línea gris 1: sep zona superior / lavado */}
                <div className="absolute left-0 right-0" style={{ top: '20%', borderTop: '1px dashed rgba(255,255,255,0.12)' }} />
                {/* Línea gris 2: sep lavado / detallado */}
                <div className="absolute left-0 right-0" style={{ top: '59%', borderTop: '1px dashed rgba(255,255,255,0.12)' }} />
                {/* Divisor sólido: cuerpo principal / cuarto inferior */}
                <div className="absolute left-0 right-0 border-t border-white/20" style={{ top: '80%' }} />
                {SP.map((pos, i) => {
                  const occupied = i < occ
                  return (
                    <div key={i} className="absolute"
                         style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10 }}>
                      <AnimatePresence mode="wait">
                        {occupied ? (
                          <motion.div key="occ"
                            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                            className="w-full h-full rounded-sm bg-yellow-400/70" />
                        ) : (
                          <motion.div key="emp"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="w-full h-full rounded-sm border border-white/15" />
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingEntry && (() => {
          const vehicle = editingEntry.vehicle
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={e => { if (e.target === e.currentTarget) setEditingEntry(null) }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                  <div>
                    <h3 className="text-base font-semibold text-white">Editar Orden</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{vehicle?.plate} · {vehicle?.brand} {vehicle?.model}</p>
                  </div>
                  <button onClick={() => setEditingEntry(null)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                  {(() => {
                    const vType    = editingEntry.vehicle?.type ?? 'automovil'
                    const allItems = editingEntry.order?.items ?? []
                    const canEdit  = editingEntry.status === 'esperando' || editingEntry.status === 'en_proceso'
                    const abono    = Number(editingEntry.order?.downpayment ?? 0)

                    const getStdPrice = (svcId: number) => {
                      const svc = services.find(s => s.id === svcId)
                      if (!svc) return 0
                      return vType === 'camion_estandar'
                        ? Number(svc.price_camion_estandar ?? svc.price_automovil)
                        : vType === 'camion_xl'
                        ? Number(svc.price_camion_xl ?? svc.price_automovil)
                        : Number(svc.price_automovil)
                    }

                    const getEffective = (svcId: number) => {
                      const custom = editForm.customPrices[svcId]
                      if (custom != null && custom !== '') return Number(parseCOP(custom))
                      return getStdPrice(svcId)
                    }

                    const editTotal = editForm.serviceIds.reduce((sum, id) => sum + getEffective(id), 0)
                    const totalBelowAbono = abono > 0 && editTotal < abono

                    // Determine which operator types are needed based on selected services (exclude third-party types)
                    const neededOpTypes = [...new Set(editForm.serviceIds.map(id => {
                      const svc = services.find(s => s.id === id)
                      const cat = svc?.category ?? allItems.find(i => i.service_id === id)?.service_category
                      return cat ? CAT_TO_OP_TYPE[cat] ?? 'detallado' : 'detallado'
                    }).filter(t => !NO_OPERATOR_TYPES.has(t)))]

                    return (
                      <>
                        {/* ── Operator selectors per type ── */}
                        {canEdit && neededOpTypes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Operarios asignados</p>
                            {neededOpTypes.map(opType => {
                              const candidates = editOperators.filter(o => (o.operator_type ?? 'detallado') === opType)
                              const selected = editForm.operatorByType[opType] ?? ''
                              const isSingle = candidates.length === 1
                              return (
                                <div key={opType} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 space-y-1">
                                  <p className="text-xs font-medium text-gray-400">{OP_TYPE_LABEL[opType] ?? opType}</p>
                                  {isSingle ? (
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
                                  {!selected && candidates.length > 1 && (
                                    <p className="text-[10px] text-orange-400">Requerido</p>
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
                                  const label = allItems.find(i => i.service_id === svcId)?.service_name
                                    ?? services.find(s => s.id === svcId)?.name
                                    ?? `Servicio ${svcId}`
                                  const stdPrice = getStdPrice(svcId)
                                  const effPrice = getEffective(svcId)
                                  const hasCustom = editForm.customPrices[svcId] != null && editForm.customPrices[svcId] !== '' && effPrice !== stdPrice
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
                                                const cp = { ...next.customPrices }
                                                delete cp[svcId]
                                                next.customPrices = cp
                                                return next
                                              })}
                                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                                              title="Eliminar servicio"
                                            >
                                              <X size={14} />
                                            </button>
                                          )}
                                        </div>
                                        {canEdit && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 shrink-0">$</span>
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              value={editForm.customPrices[svcId] != null ? fmtCOP(editForm.customPrices[svcId]) : fmtCOP(String(stdPrice))}
                                              onChange={e => {
                                                const raw = parseCOP(e.target.value)
                                                setEditForm(f => ({ ...f, customPrices: { ...f.customPrices, [svcId]: raw } }))
                                              }}
                                              onWheel={e => e.currentTarget.blur()}
                                              className="flex-1 rounded-lg border border-white/10 bg-gray-800 px-2 py-1 text-sm text-gray-100 text-right focus:border-yellow-500/40 focus:outline-none focus:ring-1 focus:ring-yellow-500/20"
                                            />
                                          </div>
                                        )}
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
                              const catServices = services.filter(s => s.category === cat && s.active)
                              if (catServices.length === 0) return null
                              const isOpen = openCats.has(cat)
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
                                                  const next = { ...f, serviceIds: [...f.serviceIds, svc.id] }
                                                  // Auto-assign operator if only 1 candidate for the service's type
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
                      </>
                    )
                  })()}
                </div>

                {(() => {
                  // Compute save validation
                  const vType = editingEntry.vehicle?.type ?? 'automovil'
                  const abono = Number(editingEntry.order?.downpayment ?? 0)
                  const getEff = (svcId: number) => {
                    const custom = editForm.customPrices[svcId]
                    if (custom != null && custom !== '') return Number(parseCOP(custom))
                    const svc = services.find(s => s.id === svcId)
                    if (!svc) return 0
                    return vType === 'camion_estandar'
                      ? Number(svc.price_camion_estandar ?? svc.price_automovil)
                      : vType === 'camion_xl'
                      ? Number(svc.price_camion_xl ?? svc.price_automovil)
                      : Number(svc.price_automovil)
                  }
                  const total = editForm.serviceIds.reduce((s, id) => s + getEff(id), 0)
                  const belowAbono = abono > 0 && total < abono
                  // Check all required operator types are assigned
                  const reqTypes = new Set<string>()
                  for (const id of editForm.serviceIds) {
                    const svc = services.find(s => s.id === id)
                    const cat = svc?.category ?? editingEntry.order?.items?.find(i => i.service_id === id)?.service_category
                    if (cat) { const t = CAT_TO_OP_TYPE[cat] ?? 'detallado'; if (!NO_OPERATOR_TYPES.has(t)) reqTypes.add(t) }
                  }
                  let missingOpType = ''
                  for (const t of reqTypes) {
                    if (!editForm.operatorByType[t]) { missingOpType = OP_TYPE_LABEL[t] ?? t; break }
                  }
                  const cantSave = belowAbono || !!missingOpType

                  return (
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
                              <Button variant="destructive" size="lg" className="flex-1" onClick={confirmCancelEntry}>
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
                                {belowAbono ? 'El total no puede ser menor al abono del cliente' : `Selecciona un operario de ${missingOpType}`}
                              </p>
                            )}
                            <div className="flex gap-3">
                              <Button variant="secondary" size="lg" className="flex-1" onClick={() => setEditingEntry(null)}>
                                Cancelar
                              </Button>
                              <Button variant="primary" size="lg" className="flex-1" onClick={saveEdit} disabled={cantSave}>
                                Guardar
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })()}
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Payment modal — shown when delivering (listo → entregado) */}
      <AnimatePresence>
        {paymentEntry && (() => {
          const total             = Number(paymentEntry.order?.total ?? 0)
          const abono            = Number(paymentEntry.order?.downpayment ?? 0)
          const restante         = Math.max(0, total - abono)
          // IVA only applies to non-detallado services (detallado prices already include IVA)
          const DETALLADO = new Set(['exterior', 'interior', 'ceramico', 'correccion_pintura'])
          const nonDetailladoTotal = (paymentEntry.order?.items ?? [])
            .filter(i => !DETALLADO.has(i.service_category))
            .reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)
          const ivaAmt            = Math.round(nonDetailladoTotal * 0.19)
          const effectiveRestante = applyIva ? restante + ivaAmt : restante

          const METHODS = [
            { key: 'cash',        label: 'Efectivo',           sub: null },
            { key: 'datafono',    label: 'Banco Caja Social',  sub: null },
            { key: 'nequi',       label: 'Nequi',              sub: '3118777229 · NEQUIJUL11739' },
            { key: 'bancolombia', label: 'Bancolombia Ahorros', sub: '60123354942 · @SaraP9810' },
          ]

          const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"

          const latItems = (paymentEntry.order?.items ?? []).filter(i => i.service_category === 'latoneria')
          const hasLatoneria = latItems.length > 0
          const latClientTotal = latItems.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)

          const checkedKeys = Object.keys(payMethods)
          const isMulti     = checkedKeys.length > 1
          const covered     = isMulti ? checkedKeys.reduce((s, k) => s + (Number(payMethods[k]) || 0), 0) : effectiveRestante
          const diff        = effectiveRestante - covered

          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={e => { if (e.target === e.currentTarget) setPaymentEntry(null) }}
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

                {/* Method checkboxes — only shown when there's an amount to collect */}
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
                    {/* Balance indicator for multi-method payment */}
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

                {/* Latonería operator pay */}
                {hasLatoneria && (
                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-blue-400 font-medium uppercase tracking-wider">Pago al operario de latonería</p>
                      <span className="text-xs text-gray-500">máx. <span className="text-gray-300 font-medium">${latClientTotal.toLocaleString('es-CO')}</span></span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="$0"
                      value={latPay ? `$${fmtCOP(latPay)}` : ''}
                      onChange={e => {
                        const raw = parseCOP(e.target.value)
                        if (raw === '') { setLatPay(''); return }
                        setLatPay(String(Math.min(Number(raw), latClientTotal)))
                      }}
                      className="w-full rounded-xl border border-blue-500/30 bg-white/5 px-3 py-2.5 text-sm text-gray-100 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="text-[11px] text-gray-600">Total latonería cobrado al cliente: <span className="text-gray-400">${latClientTotal.toLocaleString('es-CO')}</span></p>
                  </div>
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

                          {/* Nombre + Teléfono (pre-filled) */}
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
                  <Button variant="secondary" size="md" className="flex-1" onClick={() => setPaymentEntry(null)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="md" className="flex-1"
                    onClick={confirmDelivery}
                    disabled={delivering || (effectiveRestante > 0 && Object.keys(payMethods).length === 0) || (hasLatoneria && !latPay)}>
                    {delivering ? 'Entregando...' : 'Confirmar Entrega'}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Operator picker modal */}
      <AnimatePresence>
        {operatorPickEntry && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setOperatorPickEntry(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-4"
            >
              <div>
                <h3 className="text-base font-semibold text-white">Asignar Operario</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Para iniciar el proceso es necesario asignar un operario a{' '}
                  <span className="text-gray-300">{operatorPickEntry.vehicle?.brand} {operatorPickEntry.vehicle?.plate}</span>.
                </p>
              </div>
              <Select
                label="Operario *"
                value={pickedOpId || '0'}
                onValueChange={v => setPickedOpId(v === '0' ? '' : v)}
                options={[
                  { value: '0', label: 'Seleccionar operario...' },
                  ...activeOperators.map(op => ({ value: String(op.id), label: op.name })),
                ]}
              />
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-400">
                  Daños / piezas faltantes <span className="text-gray-600 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Rayón en puerta trasera derecha, tapón de gasolina roto..."
                  value={entryNotes}
                  onChange={e => setEntryNotes(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => setOperatorPickEntry(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="md" className="flex-1"
                  onClick={confirmAdvanceWithOperator}
                  disabled={!pickedOpId || picking}>
                  {picking ? 'Iniciando...' : 'Iniciar Proceso'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
