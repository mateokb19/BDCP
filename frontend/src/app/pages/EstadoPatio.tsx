import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Clock, ArrowRight, MapPin, Wrench, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { VehicleTypeIcon } from '@/app/components/ui/VehicleTypeIcon'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiPatioEntry } from '@/api'
import { Select } from '@/app/components/ui/Select'
import { useAppContext } from '@/app/context/AppContext'
import type { PatioStatus } from '@/types'

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
  onAdvance: (id: number) => void
  onEdit:    (entry: ApiPatioEntry) => void
}

function PatioCard({ entry, opName, onAdvance, onEdit }: PatioCardProps) {
  const elapsed = useElapsed(entry.started_at ?? entry.entered_at)
  const next    = NEXT_STATUS[entry.status as PatioStatus]
  const vehicle = entry.vehicle
  const items   = entry.order?.items ?? []

  return (
    <motion.div
      layout
      layoutId={`patio-${entry.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {vehicle && (
            <div className="rounded-xl bg-white/8 p-2">
              <VehicleTypeIcon type={vehicle.type as any} size={18} className="text-gray-300" />
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-white">
              {vehicle?.brand ?? '—'} {vehicle?.model}
            </div>
            <div className="text-xs text-gray-500">
              {vehicle?.plate ?? '—'}{vehicle?.color ? ` · ${vehicle.color}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {entry.position && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={11} /> {entry.position}
            </div>
          )}
          {entry.status !== 'entregado' && (
            <button
              onClick={() => onEdit(entry)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-colors"
              title="Editar"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Order + operator */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="text-gray-400 font-mono">{entry.order?.order_number}</span>
        {opName && (
          <>
            <span>·</span>
            <Wrench size={11} />
            <span className="text-gray-400">{opName}</span>
          </>
        )}
        {!opName && entry.status === 'esperando' && (
          <span className="text-orange-500/70 italic">Sin operario</span>
        )}
      </div>

      {/* Services */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map(item => (
            <Badge key={item.id} variant="default" className="text-[10px] py-0.5">
              {item.service_name}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/6">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} />
          <span>{elapsed}</span>
        </div>
        {next && (
          <Button variant="outline" size="sm" onClick={() => onAdvance(entry.id)}
            className="text-xs py-1 h-7">
            {NEXT_LABEL[entry.status as PatioStatus]} <ArrowRight size={12} />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export default function EstadoPatio() {
  const { operators } = useAppContext()
  const [entries,  setEntries]  = useState<ApiPatioEntry[]>([])
  const [loading,  setLoading]  = useState(true)

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<ApiPatioEntry | null>(null)
  const [editForm, setEditForm] = useState({ model: '', color: '', operatorId: '' })

  useEffect(() => {
    api.patio.list()
      .then(setEntries)
      .catch(err => toast.error(err.message ?? 'Error al cargar el patio'))
      .finally(() => setLoading(false))
  }, [])

  function openEdit(entry: ApiPatioEntry) {
    setEditForm({
      model:      entry.vehicle?.model ?? '',
      color:      entry.vehicle?.color ?? '',
      operatorId: entry.order?.operator_id ? String(entry.order.operator_id) : '',
    })
    setEditingEntry(entry)
  }

  async function saveEdit() {
    if (!editingEntry) return
    try {
      const updated = await api.patio.edit(editingEntry.id, {
        model:       editForm.model      || null,
        color:       editForm.color      || null,
        operator_id: editForm.operatorId ? Number(editForm.operatorId) : null,
      })
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      toast.success('Vehículo actualizado correctamente')
      setEditingEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function advanceStatus(id: number) {
    try {
      const updated = await api.patio.advance(id)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      const label = COLUMNS.find(c => c.status === updated.status)?.label
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → ${label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar estado')
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
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <h3 className="text-base font-semibold text-white">Editar Vehículo</h3>
                  <button onClick={() => setEditingEntry(null)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 block mb-1.5">Placa</label>
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-gray-500 font-mono">
                      {vehicle?.plate ?? '—'}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-1.5">
                      Modelo <span className="text-gray-600">(opcional)</span>
                    </label>
                    <input
                      value={editForm.model}
                      onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                      placeholder="Corolla 2020"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-1.5">
                      Color <span className="text-gray-600">(opcional)</span>
                    </label>
                    <input
                      value={editForm.color}
                      onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                      placeholder="Blanco"
                      className={inputClass}
                    />
                  </div>

                  <Select
                    label="Operario (opcional)"
                    value={editForm.operatorId || '0'}
                    onValueChange={v => setEditForm(f => ({ ...f, operatorId: v === '0' ? '' : v }))}
                    options={[
                      { value: '0', label: 'Sin asignar' },
                      ...operators.map(op => ({ value: String(op.id), label: op.name })),
                    ]}
                  />

                  <div className="flex gap-3 pt-1">
                    <Button variant="secondary" size="lg" className="flex-1" onClick={() => setEditingEntry(null)}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={saveEdit}>
                      Guardar
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
