import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronUp, Clock, User, Wrench, Hash } from 'lucide-react'
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

const TODAY = new Date().toISOString().split('T')[0]

const categoryColors: Record<string, string> = {
  exterior: 'yellow',
  interior: 'blue',
  ceramico: 'purple',
}

function OrderCard({ entry }: { entry: ApiHistorialEntry }) {
  const [expanded, setExpanded] = useState(false)
  const vehicle  = entry.vehicle
  const client   = vehicle?.client

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="w-full overflow-hidden"
    >
      <GlassCard padding className="space-y-3 overflow-hidden w-full">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-yellow-400">
                {entry.order_number}
              </span>
              <StatusBadge status={entry.status as any} />
            </div>
            <div className="text-white font-medium text-sm leading-snug truncate">
              {vehicle?.brand ?? '—'} {vehicle?.model}
              <span className="text-gray-500 font-normal ml-1.5">{vehicle?.plate}</span>
            </div>
            {vehicle?.color && (
              <div className="text-xs text-gray-500 mt-0.5">{vehicle.color}</div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-bold text-yellow-400">
              ${Number(entry.total ?? 0).toLocaleString('es-CO')}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {format(parseISO(`${entry.date}T00:00:00`), "d MMM", { locale: es })}
            </div>
          </div>
        </div>

        {/* Client + operator row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          {client && (
            <div className="flex items-center gap-1.5">
              <User size={11} />
              <span>{client.name}</span>
              {client.phone && <span className="text-gray-600">· {client.phone}</span>}
            </div>
          )}
          {entry.operator && (
            <div className="flex items-center gap-1.5">
              <Wrench size={11} />
              <span>{entry.operator.name}</span>
            </div>
          )}
        </div>

        {/* Services badges */}
        {entry.items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.items.map((item, i) => (
              <Badge
                key={i}
                variant={(categoryColors[item.service_category] ?? 'default') as any}
                className="text-[10px] py-0.5"
              >
                {item.service_name}
              </Badge>
            ))}
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full pt-1 border-t border-white/6"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Ocultar detalle' : 'Ver detalle de servicios'}
        </button>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 pt-1">
                {entry.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Badge
                        variant={(categoryColors[item.service_category] ?? 'default') as any}
                        className="text-[10px] py-0.5 shrink-0"
                      >
                        {item.service_category}
                      </Badge>
                      <span className="text-gray-300 truncate">{item.service_name}</span>
                    </div>
                    <span className="text-yellow-400 font-medium shrink-0">
                      ${Number(item.subtotal).toLocaleString('es-CO')}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-white/8 mt-2">
                  <span className="text-gray-400 text-sm">Total</span>
                  <span className="text-yellow-400 font-bold">
                    ${Number(entry.total ?? 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
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
        <AnimatePresence mode="popLayout">
          <div className="space-y-3 overflow-hidden">
            {entries.map(entry => (
              <OrderCard key={entry.id} entry={entry} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
