import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Clock, ArrowRight, Wrench, Pencil, X, ChevronDown, Calendar, Phone, User, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { VehicleTypeIcon } from '@/app/components/ui/VehicleTypeIcon'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiPatioEntry } from '@/api'
import { Select } from '@/app/components/ui/Select'
import { useAppContext } from '@/app/context/AppContext'
import type { PatioStatus, ServiceCategory } from '@/types'

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

interface PatioCardProps {
  entry:     ApiPatioEntry
  opName?:   string
  onAdvance: (entry: ApiPatioEntry) => void
  onEdit:    (entry: ApiPatioEntry) => void
}

function PatioCard({ entry, opName, onAdvance, onEdit }: PatioCardProps) {
  const elapsed  = useElapsed(entry.started_at ?? entry.entered_at)
  const next     = NEXT_STATUS[entry.status as PatioStatus]
  const vehicle  = entry.vehicle
  const items    = entry.order?.items ?? []
  const client   = vehicle?.client
  const [expanded, setExpanded] = useState(false)

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
          <div className="ml-auto shrink-0">
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

        {/* Delivery date */}
        {entry.scheduled_delivery_at && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400/80">
            <Calendar size={11} className="shrink-0" />
            <span>
              Entrega: {new Date(entry.scheduled_delivery_at).toLocaleString('es-CO', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

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
  const [entries,  setEntries]  = useState<ApiPatioEntry[]>([])
  const [loading,  setLoading]  = useState(true)

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<ApiPatioEntry | null>(null)
  const [editForm, setEditForm] = useState({ operatorId: '', serviceIds: [] as number[] })
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Operator picker modal state
  const [operatorPickEntry, setOperatorPickEntry] = useState<ApiPatioEntry | null>(null)
  const [pickedOpId, setPickedOpId]               = useState('')
  const [picking, setPicking]                     = useState(false)

  useEffect(() => {
    api.patio.list()
      .then(setEntries)
      .catch(err => toast.error(err.message ?? 'Error al cargar el patio'))
      .finally(() => setLoading(false))
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
      setOperatorPickEntry(entry)
      setPickedOpId('')
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
                          onAdvance={advanceStatus}
                          onEdit={openEdit}
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
                  ...operators.map(op => ({ value: String(op.id), label: op.name })),
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
