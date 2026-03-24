import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronUp, Clock, User, Wrench } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Badge } from '@/app/components/ui/Badge'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiHistorialEntry } from '@/api'

const TODAY = format(new Date(), 'yyyy-MM-dd')

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
    </div>
  )
}
