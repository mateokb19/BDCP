import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Clock, ArrowRight, Wrench, Pencil, X, ChevronDown, Calendar, Phone, User, ChevronUp, Banknote, CreditCard, Check } from 'lucide-react'
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
import type { PatioStatus, ServiceCategory } from '@/types'

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
              <div className="flex gap-2">
                <input
                  type="date"
                  value={draftDate}
                  min={_today()}
                  onChange={e => setDraftDate(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="flex-1 rounded-xl border border-blue-500/30 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:invert"
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

              {/* Services */}
              {items.length > 0 && (
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
        {next && (
          <Button variant="outline" size="sm" onClick={() => onAdvance(entry)}
            className="text-xs py-1 h-7 shrink-0">
            {NEXT_LABEL[entry.status as PatioStatus]} <ArrowRight size={12} />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  exterior:           'Exterior',
  interior:           'Interior',
  ceramico:           'Cerámico',
  correccion_pintura: 'Corrección de Pintura',
}
const CATEGORY_ORDER: ServiceCategory[] = ['exterior', 'interior', 'correccion_pintura', 'ceramico']

export default function EstadoPatio() {
  const { operators, services } = useAppContext()
  const [entries,        setEntries]        = useState<ApiPatioEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [facturaRecords, setFacturaRecords] = useState<Record<number, FacturaRecord>>(loadFacturas)

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<ApiPatioEntry | null>(null)
  const [editForm, setEditForm] = useState({ operatorId: '', serviceIds: [] as number[] })
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Operator picker modal state
  const [operatorPickEntry, setOperatorPickEntry] = useState<ApiPatioEntry | null>(null)
  const [pickedOpId, setPickedOpId]               = useState('')
  const [picking, setPicking]                     = useState(false)
  const [activeOperators, setActiveOperators]     = useState(operators.filter(o => (o.operator_type ?? 'detallado') === 'detallado'))

  // Payment modal state (delivery)
  const [paymentEntry, setPaymentEntry] = useState<ApiPatioEntry | null>(null)
  const [payMethods,   setPayMethods]   = useState<Record<string, string>>({})
  const [latPay,       setLatPay]       = useState('')
  const [delivering,   setDelivering]   = useState(false)
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

  function openEdit(entry: ApiPatioEntry) {
    const selectedIds = entry.order?.items.map(i => i.service_id).filter((id): id is number => id != null) ?? []
    setEditForm({ operatorId: '', serviceIds: selectedIds })
    setOpenCats(new Set())
    setConfirmCancel(false)
    setEditingEntry(entry)
  }

  async function saveEdit() {
    if (!editingEntry) return
    // If all services removed → ask for confirmation first
    const canEdit = editingEntry.status === 'esperando' || editingEntry.status === 'en_proceso'
    if (canEdit && editForm.serviceIds.length === 0) {
      setConfirmCancel(true)
      return
    }
    try {
      const updated = await api.patio.edit(editingEntry.id, {
        ...(canEdit ? { service_ids: editForm.serviceIds } : {}),
      })
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
      // Determine required operator type from service categories
      const categories = (entry.order?.items ?? []).map(i => i.service_category)
      const requiredType =
        categories.length > 0 && categories.every(c => c === 'pintura')   ? 'pintura'   :
        categories.length > 0 && categories.every(c => c === 'latoneria') ? 'latoneria' :
        'detallado'

      // Fetch fresh active operators filtered by the required type
      const allOps = await api.operators.list().catch(() => [] as typeof operators)
      const filtered = allOps.filter(o => (o.operator_type ?? 'detallado') === requiredType)

      // If only one operator available for this type, auto-assign without showing picker
      if (filtered.length === 1) {
        try {
          await api.patio.edit(entry.id, { operator_id: filtered[0].id })
          const updated = await api.patio.advance(entry.id)
          setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
          toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → En Proceso`)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Error al iniciar proceso')
        }
        return
      }
      setActiveOperators(filtered)
      setOperatorPickEntry(entry)
      setPickedOpId('')
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
      setFactura(false)
      setFacturaData({
        tipo:      'persona_natural',
        id_type:   'CC',
        id_number: '',
        dv:        '',
        name:      entry.vehicle?.client?.name  ?? '',
        phone:     entry.vehicle?.client?.phone ?? '',
        email:     '',
      })
      return
    }
    try {
      const updated = await api.patio.advance(entry.id)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      const label = COLUMNS.find(c => c.status === updated.status)?.label
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → ${label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar estado')
    }
  }

  async function confirmDelivery() {
    if (!paymentEntry) return
    const restante = Math.max(0, Number(paymentEntry.order?.total ?? 0) - Number(paymentEntry.order?.downpayment ?? 0))
    const keyToField: Record<string, 'payment_cash' | 'payment_datafono' | 'payment_nequi' | 'payment_bancolombia'> = {
      cash:        'payment_cash',
      datafono:    'payment_datafono',
      nequi:       'payment_nequi',
      bancolombia: 'payment_bancolombia',
    }
    const payment = { payment_cash: 0, payment_datafono: 0, payment_nequi: 0, payment_bancolombia: 0 }
    const checkedKeys = Object.keys(payMethods)
    if (checkedKeys.length === 1) {
      payment[keyToField[checkedKeys[0]]] = restante
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
      // Persist factura data keyed by order id
      if (factura && facturaData.id_number && paymentEntry.order?.id) {
        const next = { ...facturaRecords, [paymentEntry.order.id]: facturaData as FacturaRecord }
        setFacturaRecords(next)
        localStorage.setItem(FACTURA_KEY, JSON.stringify(next))
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
      await api.patio.edit(operatorPickEntry.id, { operator_id: Number(pickedOpId) })
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

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"

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

      {/* Kanban */}
      <LayoutGroup>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

                    const getPrice = (svcId: number) => {
                      const snap = allItems.find(i => i.service_id === svcId)?.unit_price
                      if (snap != null) return Number(snap)
                      const svc = services.find(s => s.id === svcId)
                      if (!svc) return 0
                      return vType === 'camion_estandar'
                        ? Number(svc.price_camion_estandar ?? svc.price_automovil)
                        : vType === 'camion_xl'
                        ? Number(svc.price_camion_xl ?? svc.price_automovil)
                        : Number(svc.price_automovil)
                    }

                    const editTotal = editForm.serviceIds.reduce((sum, id) => sum + getPrice(id), 0)

                    return (
                      <>
                        {/* ── Selected services ── */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-300">
                              Servicios
                              <span className="ml-2 text-xs text-gray-600">({editForm.serviceIds.length})</span>
                            </p>
                            {editTotal > 0 && (
                              <span className="text-base font-bold text-yellow-400">
                                ${editTotal.toLocaleString('es-CO')}
                              </span>
                            )}
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
                                  const price = getPrice(svcId)
                                  return (
                                    <motion.div
                                      key={svcId}
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.16 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                                        <div>
                                          <p className="text-sm text-gray-200">{label}</p>
                                          <p className="text-xs text-gray-500">${price.toLocaleString('es-CO')}</p>
                                        </div>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => setEditForm(f => ({
                                              ...f,
                                              serviceIds: f.serviceIds.filter(id => id !== svcId),
                                            }))}
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Eliminar servicio"
                                          >
                                            <X size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </motion.div>
                                  )
                                })}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>

                        {/* ── Add services accordion (esperando only) ── */}
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
                                                onClick={() => setEditForm(f => ({ ...f, serviceIds: [...f.serviceIds, svc.id] }))}
                                                className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors text-left"
                                              >
                                                <span className="text-sm text-gray-300">{svc.name}</span>
                                                <span className="text-xs text-gray-500">
                                                  +${getPrice(svc.id).toLocaleString('es-CO')}
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
                        className="flex gap-3"
                      >
                        <Button variant="secondary" size="lg" className="flex-1" onClick={() => setEditingEntry(null)}>
                          Cancelar
                        </Button>
                        <Button variant="primary" size="lg" className="flex-1" onClick={saveEdit}>
                          Guardar
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Payment modal — shown when delivering (listo → entregado) */}
      <AnimatePresence>
        {paymentEntry && (() => {
          const total    = Number(paymentEntry.order?.total ?? 0)
          const abono    = Number(paymentEntry.order?.downpayment ?? 0)
          const restante = Math.max(0, total - abono)

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
          const covered     = isMulti ? checkedKeys.reduce((s, k) => s + (Number(payMethods[k]) || 0), 0) : restante
          const diff        = restante - covered

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
                    <span className="text-yellow-400">${restante.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                {/* Method checkboxes — only shown when there's an amount to collect */}
                {restante > 0 && (
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
                    disabled={delivering || (restante > 0 && Object.keys(payMethods).length === 0) || (hasLatoneria && !latPay)}>
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
