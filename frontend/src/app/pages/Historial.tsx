import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronUp, Clock, User, Wrench, Download, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'
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
const LS_KEY = 'bdcpolo_revealed_orders'
const ADMIN_PASSWORD = 'BDCP123'
const RESTRICTED_CATS = new Set(['ppf', 'polarizado'])

function hasRestrictedServices(entry: { items: { service_category: string }[] }) {
  return entry.items.some(i => RESTRICTED_CATS.has(i.service_category))
}

function loadRevealed(): Set<number> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) as number[] : [])
  } catch { return new Set() }
}
function saveRevealed(ids: Set<number>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
}

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  automovil: 'Automóvil', camion_estandar: 'C. Estándar', camion_xl: 'C. XL',
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtPaymentMethod(e: ApiHistorialEntry): string {
  const methods = [
    Number(e.payment_cash)        > 0 && 'Efectivo',
    Number(e.payment_datafono)    > 0 && 'Datafono',
    Number(e.payment_nequi)       > 0 && 'Nequi',
    Number(e.payment_bancolombia) > 0 && 'Bancolombia',
  ].filter(Boolean) as string[]
  return methods.length ? methods.join(' + ') : '—'
}

function printReport(entries: ApiHistorialEntry[], dateFrom: string, dateTo: string) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const tableRows = sorted.map(entry => {
    const brandModel = [entry.vehicle?.brand, entry.vehicle?.model].filter(Boolean).join(' ')
    const vt        = brandModel || VEHICLE_TYPE_LABEL[entry.vehicle?.type ?? ''] || '—'
    const plate     = entry.vehicle?.plate ?? '—'
    const op        = entry.operator?.name ?? '—'
    const dateLabel = format(parseISO(`${entry.date}T00:00:00`), 'dd/MM/yyyy')
    const services  = entry.items.map(i => esc(i.service_name)).join('<br>')
    const total     = Number(entry.total ?? 0)
    const payment   = fmtPaymentMethod(entry)
    return `<tr>
      <td>${esc(dateLabel)}</td><td>${esc(vt)}</td><td class="plate">${esc(plate)}</td>
      <td>${services}</td><td>${esc(op)}</td>
      <td class="price">$${total.toLocaleString('es-CO')}</td>
      <td style="text-align:center">${esc(payment)}</td>
    </tr>`
  }).join('')
  const grandTotal = sorted.reduce((s, e) => s + Number(e.total ?? 0), 0)
  const fromLabel = format(parseISO(`${dateFrom}T00:00:00`), "d 'de' MMMM yyyy", { locale: es })
  const toLabel   = format(parseISO(`${dateTo}T00:00:00`), "d 'de' MMMM yyyy", { locale: es })
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte BDCPolo</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;padding:20px;color:#000}
  h1{text-align:center;font-size:14px;font-weight:bold;letter-spacing:1px;margin-bottom:3px}
  .period{text-align:center;font-size:10px;color:#555;margin-bottom:14px}
  table{width:100%;border-collapse:collapse}
  th{background:#e8e8e8;font-weight:bold;text-transform:uppercase;font-size:9px;padding:6px 5px;border:1px solid #aaa;text-align:center}
  td{padding:4px 5px;border:1px solid #ccc;vertical-align:middle}
  .plate{font-family:monospace;font-weight:bold;text-align:center}.price{text-align:right;white-space:nowrap}
  .total-row td{font-weight:bold;background:#f5f5f5;border-top:2px solid #888}</style></head>
  <body onload="window.print()">
    <h1>BOGOTA DETAILING CENTER</h1>
    <p class="period">Reporte de servicios: ${esc(fromLabel)} — ${esc(toLabel)}</p>
    <table><thead><tr>
      <th>Fecha</th><th>Vehículo</th><th>Placa</th>
      <th>Servicio</th><th>Operario</th><th>Valor del Servicio</th><th>Método de Pago</th>
    </tr></thead><tbody>
      ${tableRows}
      <tr class="total-row"><td colspan="5" style="text-align:right">TOTAL</td>
        <td class="price">$${grandTotal.toLocaleString('es-CO')}</td><td></td></tr>
    </tbody></table>
  </body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const categoryColors: Record<string, string> = {
  exterior: 'yellow', interior: 'blue', ceramico: 'purple',
}

function OrderCard({
  entry,
  toggleButton,
}: {
  entry: ApiHistorialEntry
  toggleButton?: React.ReactNode
}) {
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
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {vehicle?.brand ?? '—'}{vehicle?.model ? ` ${vehicle.model}` : ''}
          </p>
        </div>
        <span className="font-mono text-xs font-semibold text-gray-400 shrink-0">{vehicle?.plate ?? '—'}</span>
        <span className="text-xs text-gray-600 shrink-0">
          {format(parseISO(`${entry.date}T00:00:00`), "d MMM", { locale: es })}
        </span>
        {toggleButton && <span onClick={e => e.stopPropagation()}>{toggleButton}</span>}
        <span className="text-gray-600 shrink-0">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-yellow-400">{entry.order_number}</span>
                  <StatusBadge status={entry.status as any} />
                </div>
                <span className="text-sm font-bold text-yellow-400">
                  ${Number(entry.total ?? 0).toLocaleString('es-CO')}
                </span>
              </div>
              {vehicle?.color && <p className="text-xs text-gray-500">{vehicle.color}</p>}
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
              {(Number(entry.payment_cash) + Number(entry.payment_datafono) + Number(entry.payment_nequi) + Number(entry.payment_bancolombia)) > 0 && (
                <p className="text-xs text-gray-400">
                  <span className="text-gray-600">Pago:</span> {fmtPaymentMethod(entry)}
                </p>
              )}
              {entry.items.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/6">
                  {entry.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant={(categoryColors[item.service_category] ?? 'default') as any} className="text-[9px] shrink-0">
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

// ─── Shared download modal ───────────────────────────────────────────────────
function DownloadModal({
  open,
  onClose,
  onDownload,
  loading,
}: {
  open: boolean
  onClose: () => void
  onDownload: (from: string, to: string) => void
  loading: boolean
}) {
  const [dlFrom, setDlFrom] = useState(TODAY)
  const [dlTo,   setDlTo]   = useState(TODAY)
  const weekInputRef  = useRef<HTMLInputElement>(null)
  const monthInputRef = useRef<HTMLInputElement>(null)

  const now       = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const YESTERDAY = format(yesterday, 'yyyy-MM-dd')
  const isToday     = dlFrom === TODAY && dlTo === TODAY
  const isYesterday = dlFrom === YESTERDAY && dlTo === YESTERDAY
  const isCustomWeek  = !isToday && !isYesterday && dlFrom !== dlTo &&
    dlFrom === format(startOfWeek(parseISO(dlFrom), { weekStartsOn: 0 }), 'yyyy-MM-dd')
  const isCustomMonth = !isToday && !isYesterday && dlFrom !== dlTo && !isCustomWeek
  const btnCls = (active: boolean) => cn(
    'rounded-xl border py-2.5 px-3 text-sm font-medium transition-colors',
    active
      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      : 'bg-white/5 border-white/8 text-gray-400 hover:bg-white/10 hover:text-gray-200'
  )

  return (
    <Modal open={open} onClose={onClose} title="Descargar reporte" size="sm">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btnCls(isToday)} onClick={() => { setDlFrom(TODAY); setDlTo(TODAY) }}>Hoy</button>
          <button type="button" className={btnCls(isYesterday)} onClick={() => { setDlFrom(YESTERDAY); setDlTo(YESTERDAY) }}>Ayer</button>
          <button type="button" className={btnCls(isCustomWeek)} onClick={() => weekInputRef.current?.showPicker()}>Elegir semana</button>
          <button type="button" className={btnCls(isCustomMonth)} onClick={() => monthInputRef.current?.showPicker()}>Elegir mes</button>
        </div>

        <input ref={weekInputRef} type="date" className="sr-only" tabIndex={-1}
          onChange={e => {
            if (!e.target.value) return
            const d   = parseISO(e.target.value)
            const sun = startOfWeek(d, { weekStartsOn: 0 })
            const sat = new Date(sun.getTime() + 6 * 24 * 60 * 60 * 1000)
            setDlFrom(format(sun, 'yyyy-MM-dd')); setDlTo(format(sat, 'yyyy-MM-dd'))
          }}
        />
        <input ref={monthInputRef} type="month" className="sr-only" tabIndex={-1}
          onChange={e => {
            if (!e.target.value) return
            const [y, m] = e.target.value.split('-').map(Number)
            const d = new Date(y, m - 1, 1)
            setDlFrom(format(startOfMonth(d), 'yyyy-MM-dd')); setDlTo(format(endOfMonth(d), 'yyyy-MM-dd'))
          }}
        />

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
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={() => onDownload(dlFrom, dlTo)} disabled={loading}>
            {loading ? 'Generando...' : <><Download size={15} /> Descargar PDF</>}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Historial() {
  const [revealedIds, setRevealedIds] = useState<Set<number>>(() => loadRevealed())

  // Login
  const [showLogin, setShowLogin]   = useState(false)
  const [loginInput, setLoginInput] = useState('')
  const [adminView, setAdminView]   = useState(false)

  function submitLogin() {
    if (loginInput === ADMIN_PASSWORD) {
      setAdminView(true)
      setShowLogin(false)
      setLoginInput('')
    } else {
      toast.error('Contraseña incorrecta')
    }
  }

  function toggleRevealed(id: number) {
    const next = new Set(revealedIds)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    saveRevealed(next)
    setRevealedIds(next)
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  const [entries, setEntries]         = useState<ApiHistorialEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [dateFilter, setDateFilter]   = useState(TODAY)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showDlModal, setShowDlModal] = useState(false)
  const [dlLoading, setDlLoading]     = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.history.list({ date_filter: dateFilter, search: debouncedSearch || undefined })
      setEntries(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar historial')
    } finally { setLoading(false) }
  }, [dateFilter, debouncedSearch])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const visibleEntries = entries.filter(e => !hasRestrictedServices(e) || revealedIds.has(e.id))

  async function handleMainDownload(from: string, to: string) {
    if (!from || !to) { toast.error('Selecciona el rango de fechas'); return }
    if (from > to)    { toast.error('La fecha inicial no puede ser mayor a la final'); return }
    setDlLoading(true)
    try {
      const data = await api.history.list({ date_from: from, date_to: to })
      const filtered = data.filter(e => !hasRestrictedServices(e) || revealedIds.has(e.id))
      if (filtered.length === 0) { toast.error('No hay servicios en ese período'); return }
      printReport(filtered, from, to)
      setShowDlModal(false)
    } catch { toast.error('Error al generar el reporte') }
    finally { setDlLoading(false) }
  }

  // ── Admin view ─────────────────────────────────────────────────────────────
  const [adminEntries, setAdminEntries]         = useState<ApiHistorialEntry[]>([])
  const [adminLoading, setAdminLoading]         = useState(false)
  const [adminDateFilter, setAdminDateFilter]   = useState(TODAY)
  const [adminSearch, setAdminSearch]           = useState('')
  const [adminDebouncedSearch, setAdminDebouncedSearch] = useState('')
  const [showAdminDlModal, setShowAdminDlModal] = useState(false)
  const [adminDlLoading, setAdminDlLoading]     = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAdminDebouncedSearch(adminSearch), 350)
    return () => clearTimeout(t)
  }, [adminSearch])

  const fetchAdminHistory = useCallback(async () => {
    if (!adminView) return
    setAdminLoading(true)
    try {
      const data = await api.history.list({ date_filter: adminDateFilter, search: adminDebouncedSearch || undefined })
      setAdminEntries(data.filter(hasRestrictedServices))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar historial')
    } finally { setAdminLoading(false) }
  }, [adminView, adminDateFilter, adminDebouncedSearch])

  useEffect(() => { fetchAdminHistory() }, [fetchAdminHistory])

  async function handleAdminDownload(from: string, to: string) {
    if (!from || !to) { toast.error('Selecciona el rango de fechas'); return }
    if (from > to)    { toast.error('La fecha inicial no puede ser mayor a la final'); return }
    setAdminDlLoading(true)
    try {
      const data = await api.history.list({ date_from: from, date_to: to })
      if (data.length === 0) { toast.error('No hay servicios en ese período'); return }
      printReport(data, from, to)  // no filter — all services
      setShowAdminDlModal(false)
    } catch { toast.error('Error al generar el reporte') }
    finally { setAdminDlLoading(false) }
  }

  // ── Render: admin view ─────────────────────────────────────────────────────
  if (adminView) {
    return (
      <div className="max-w-xl mx-auto">
        <PageHeader
          title="PPF y Polarizado"
          subtitle={`${adminEntries.length} servicio${adminEntries.length !== 1 ? 's' : ''}`}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => setAdminView(false)}>
                <ArrowLeft size={15} /> Volver
              </Button>
              <Button variant="secondary" size="md" onClick={() => setShowAdminDlModal(true)}>
                <Download size={15} /> Descargar
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-3 mb-5">
          <input
            type="date"
            value={adminDateFilter}
            onChange={e => setAdminDateFilter(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none"
          />
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={adminSearch}
              onChange={e => setAdminSearch(e.target.value)}
              placeholder="Buscar por placa, nombre o número de orden..."
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
            />
          </div>
        </div>

        {adminLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-gray-500 text-sm">Cargando historial...</p>
          </div>
        ) : adminEntries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Sin servicios"
            description={adminDebouncedSearch ? 'No se encontraron resultados para tu búsqueda' : 'No hay servicios PPF ni Polarizado en esta fecha'}
          />
        ) : (
          <div className="space-y-3 w-full overflow-hidden">
            <AnimatePresence>
              {adminEntries.map(entry => {
                const isRevealed = revealedIds.has(entry.id)
                return (
                  <OrderCard
                    key={entry.id}
                    entry={entry}
                    toggleButton={
                      <button
                        title={isRevealed ? 'Ocultar del historial principal' : 'Mostrar en historial principal'}
                        onClick={() => toggleRevealed(entry.id)}
                        className={cn(
                          'p-1.5 rounded-lg border transition-colors',
                          isRevealed
                            ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                            : 'border-white/10 bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                        )}
                      >
                        {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    }
                  />
                )
              })}
            </AnimatePresence>
          </div>
        )}

        <DownloadModal
          open={showAdminDlModal}
          onClose={() => setShowAdminDlModal(false)}
          onDownload={handleAdminDownload}
          loading={adminDlLoading}
        />
      </div>
    )
  }

  // ── Render: main view ──────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Historial"
        subtitle={`${visibleEntries.length} servicio${visibleEntries.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowLogin(true); setLoginInput('') }}
              title="Gestionar PPF / Polarizado"
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300 transition-colors"
            >
              <Eye size={15} />
            </button>
            <Button variant="secondary" size="md" onClick={() => setShowDlModal(true)}>
              <Download size={15} /> Descargar
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 mb-5">
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none"
        />
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500 text-sm">Cargando historial...</p>
        </div>
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin servicios"
          description={debouncedSearch ? 'No se encontraron resultados para tu búsqueda' : 'No hay servicios registrados para esta fecha'}
        />
      ) : (
        <div className="space-y-3 w-full overflow-hidden">
          <AnimatePresence>
            {visibleEntries.map(entry => (
              <OrderCard key={entry.id} entry={entry} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Login modal */}
      <Modal open={showLogin} onClose={() => setShowLogin(false)} size="sm">
        <div className="p-6 space-y-4">
          <input
            type="password"
            value={loginInput}
            onChange={e => setLoginInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitLogin()}
            placeholder="Contraseña"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
          />
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setShowLogin(false)}>Cancelar</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={submitLogin}>Ir</Button>
          </div>
        </div>
      </Modal>

      <DownloadModal
        open={showDlModal}
        onClose={() => setShowDlModal(false)}
        onDownload={handleMainDownload}
        loading={dlLoading}
      />
    </div>
  )
}
