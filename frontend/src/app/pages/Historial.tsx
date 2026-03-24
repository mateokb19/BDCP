import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronUp, Clock, User, Wrench, Download } from 'lucide-react'
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { Modal } from '@/app/components/ui/Modal'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiHistorialEntry } from '@/api'

const TODAY = format(new Date(), 'yyyy-MM-dd')

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  automovil:       'Automóvil',
  camion_estandar: 'C. Estándar',
  camion_xl:       'C. XL',
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printHistorialReport(entries: ApiHistorialEntry[], dateFrom: string, dateTo: string) {
  // One row per order — services joined in a single cell
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)

  const tableRows = sorted.map(entry => {
    const vt        = VEHICLE_TYPE_LABEL[entry.vehicle?.type ?? ''] ?? (entry.vehicle?.type ?? '—')
    const plate     = entry.vehicle?.plate ?? '—'
    const op        = entry.operator?.name ?? '—'
    const dateLabel = format(parseISO(`${entry.date}T00:00:00`), 'dd/MM/yyyy')
    const services  = entry.items.map(i => esc(i.service_name)).join('<br>')
    const total     = Number(entry.total ?? 0)
    return `
    <tr>
      <td>${esc(dateLabel)}</td>
      <td>${esc(vt)}</td>
      <td class="plate">${esc(plate)}</td>
      <td>${services}</td>
      <td>${esc(op)}</td>
      <td class="price">$${total.toLocaleString('es-CO')}</td>
      <td></td>
    </tr>`
  }).join('')

  const grandTotal = sorted.reduce((s, e) => s + Number(e.total ?? 0), 0)

  const fromLabel = format(parseISO(`${dateFrom}T00:00:00`), "d 'de' MMMM yyyy", { locale: es })
  const toLabel   = format(parseISO(`${dateTo}T00:00:00`),   "d 'de' MMMM yyyy", { locale: es })

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte BDCPolo</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:10px;padding:20px;color:#000}
    h1{text-align:center;font-size:14px;font-weight:bold;letter-spacing:1px;margin-bottom:3px}
    .period{text-align:center;font-size:10px;color:#555;margin-bottom:14px}
    table{width:100%;border-collapse:collapse}
    th{background:#e8e8e8;font-weight:bold;text-transform:uppercase;font-size:9px;padding:6px 5px;border:1px solid #aaa;text-align:center}
    td{padding:4px 5px;border:1px solid #ccc;vertical-align:middle}
    .plate{font-family:monospace;font-weight:bold;text-align:center}
    .price{text-align:right;white-space:nowrap}
    .total-row td{font-weight:bold;background:#f5f5f5;border-top:2px solid #888}
  </style>
  </head>
  <body onload="window.print()">
    <h1>BOGOTA DETAILING CENTER</h1>
    <p class="period">Reporte de servicios: ${esc(fromLabel)} — ${esc(toLabel)}</p>
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Tipo de Vehículo</th><th>Placa</th>
          <th>Servicio</th><th>Operario</th><th>Valor del Servicio</th><th>Método de Pago</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">TOTAL</td>
          <td class="price">$${grandTotal.toLocaleString('es-CO')}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const categoryColors: Record<string, string> = {
  exterior: 'yellow',
  interior: 'blue',
  ceramico: 'purple',
}

function OrderCard({ entry }: { entry: ApiHistorialEntry }) {
  const [expanded, setExpanded] = useState(false)
  const vehicle = entry.vehicle
  const client  = vehicle?.client

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        {/* Brand + model */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {vehicle?.brand ?? '—'}{vehicle?.model ? ` ${vehicle.model}` : ''}
          </p>
        </div>
        {/* Plate */}
        <span className="font-mono text-xs font-semibold text-gray-400 shrink-0">
          {vehicle?.plate ?? '—'}
        </span>
        {/* Date */}
        <span className="text-xs text-gray-600 shrink-0">
          {format(parseISO(`${entry.date}T00:00:00`), "d MMM", { locale: es })}
        </span>
        {/* Chevron */}
        <span className="text-gray-600 shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expandable detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-1 px-3 py-3 rounded-b-xl border border-t-0 border-white/8 bg-white/[0.02] space-y-2.5">

              {/* Order + status + total */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-yellow-400">{entry.order_number}</span>
                  <StatusBadge status={entry.status as any} />
                </div>
                <span className="text-sm font-bold text-yellow-400">
                  ${Number(entry.total ?? 0).toLocaleString('es-CO')}
                </span>
              </div>

              {/* Color */}
              {vehicle?.color && (
                <p className="text-xs text-gray-500">{vehicle.color}</p>
              )}

              {/* Client + operator */}
              <div className="space-y-0.5">
                {client && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <User size={10} className="shrink-0" />
                    <span className="truncate">{client.name}</span>
                    {client.phone && <span className="text-gray-600 shrink-0">· {client.phone}</span>}
                  </div>
                )}
                {entry.operator && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Wrench size={10} className="shrink-0" />
                    <span className="truncate">{entry.operator.name}</span>
                  </div>
                )}
              </div>

              {/* Services */}
              {entry.items.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/6">
                  {entry.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge
                        variant={(categoryColors[item.service_category] ?? 'default') as any}
                        className="text-[9px] shrink-0"
                      >
                        {item.service_category}
                      </Badge>
                      <span className="text-gray-300 truncate flex-1 min-w-0">{item.service_name}</span>
                      <span className="text-yellow-400 font-medium shrink-0">
                        ${Number(item.subtotal).toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Historial() {
  const [entries, setEntries]     = useState<ApiHistorialEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [dateFilter, setDateFilter] = useState(TODAY)
  const [search, setSearch]       = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Download modal
  const [showDlModal, setShowDlModal] = useState(false)
  const [dlFrom, setDlFrom] = useState(TODAY)
  const [dlTo,   setDlTo]   = useState(TODAY)
  const [dlLoading, setDlLoading] = useState(false)

  async function handleDownload() {
    if (!dlFrom || !dlTo) { toast.error('Selecciona el rango de fechas'); return }
    if (dlFrom > dlTo)    { toast.error('La fecha inicial no puede ser mayor a la final'); return }
    setDlLoading(true)
    try {
      const data = await api.history.list({ date_from: dlFrom, date_to: dlTo })
      if (data.length === 0) { toast.error('No hay servicios en ese período'); return }
      printHistorialReport(data, dlFrom, dlTo)
      setShowDlModal(false)
    } catch {
      toast.error('Error al generar el reporte')
    } finally {
      setDlLoading(false)
    }
  }

  // Debounce search input 350ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.history.list({
        date_filter: dateFilter,
        search: debouncedSearch || undefined,
      })
      setEntries(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }, [dateFilter, debouncedSearch])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const totalDay = entries.reduce((sum, e) => sum + Number(e.total ?? 0), 0)

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Historial"
        subtitle={`${entries.length} servicio${entries.length !== 1 ? 's' : ''} · $${totalDay.toLocaleString('es-CO')}`}
        actions={
          <Button variant="secondary" size="md" onClick={() => setShowDlModal(true)}>
            <Download size={15} /> Descargar
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Date picker */}
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none"
        />
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa, nombre o número de orden..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500 text-sm">Cargando historial...</p>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin servicios"
          description={debouncedSearch ? 'No se encontraron resultados para tu búsqueda' : 'No hay servicios registrados para esta fecha'}
        />
      ) : (
        <div className="space-y-3 w-full overflow-hidden">
          <AnimatePresence>
            {entries.map(entry => (
              <OrderCard key={entry.id} entry={entry} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Download modal */}
      <Modal open={showDlModal} onClose={() => setShowDlModal(false)} title="Descargar reporte" size="sm">
        <div className="p-6 space-y-4">
          {/* Quick-select buttons */}
          {(() => {
            const now = new Date()
            const presets = [
              {
                label: 'Esta semana',
                from: format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
                to:   TODAY,
              },
              {
                label: 'Este mes',
                from: format(startOfMonth(now), 'yyyy-MM-dd'),
                to:   TODAY,
              },
              {
                label: format(subMonths(now, 1), 'MMMM', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
                from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
                to:   format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd'),
              },
              {
                label: format(subMonths(now, 2), 'MMMM', { locale: es }).replace(/^\w/, c => c.toUpperCase()),
                from: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
                to:   format(endOfMonth(subMonths(now, 2)),   'yyyy-MM-dd'),
              },
            ]
            return (
              <div className="grid grid-cols-2 gap-2">
                {presets.map(p => {
                  const active = dlFrom === p.from && dlTo === p.to
                  return (
                    <button key={p.label} type="button"
                      onClick={() => { setDlFrom(p.from); setDlTo(p.to) }}
                      className={cn(
                        'rounded-xl border py-2 px-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                          : 'bg-white/5 border-white/8 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          {/* Manual date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Desde</label>
              <input type="date" value={dlFrom} onChange={e => setDlFrom(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none [color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Hasta</label>
              <input type="date" value={dlTo} onChange={e => setDlTo(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none [color-scheme:dark]" />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setShowDlModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleDownload} disabled={dlLoading}>
              {dlLoading ? 'Generando...' : <><Download size={15} /> Descargar PDF</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
