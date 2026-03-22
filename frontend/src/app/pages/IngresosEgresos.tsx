import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Banknote, CreditCard, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiIngresosResponse, type ApiIngresosDayTotal } from '@/api'

type Period = 'day' | 'week' | 'month' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  day:   'Hoy',
  week:  'Semana',
  month: 'Mes',
  year:  'Año',
}

const METHODS = [
  { key: 'payment_cash'        as const, label: 'Efectivo',    color: '#eab308', icon: <Banknote size={14} /> },
  { key: 'payment_datafono'    as const, label: 'Datáfono',    color: '#3b82f6', icon: <CreditCard size={14} /> },
  { key: 'payment_nequi'       as const, label: 'Nequi',       color: '#a855f7', icon: <CreditCard size={14} /> },
  { key: 'payment_bancolombia' as const, label: 'Bancolombia', color: '#ef4444', icon: <CreditCard size={14} /> },
]

const TOOLTIP_STYLE = {
  contentStyle: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}

function fmt(n: string | number) {
  return `$${Number(n).toLocaleString('es-CO')}`
}

export default function IngresosEgresos() {
  const [period,  setPeriod]  = useState<Period>('month')
  const [data,    setData]    = useState<ApiIngresosResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.ingresos.get(period)
      .then(setData)
      .catch(err => toast.error(err.message ?? 'Error al cargar ingresos'))
      .finally(() => setLoading(false))
  }, [period])

  // Chart data: for year → group daily_totals by month; else daily
  const chartData = useMemo(() => {
    if (!data) return []
    if (period === 'year') {
      const months: Record<string, { label: string; total: number }> = {}
      data.daily_totals.forEach(d => {
        const key   = d.date.slice(0, 7)               // YYYY-MM
        const label = format(parseISO(d.date), 'MMM', { locale: es })
        if (!months[key]) months[key] = { label, total: 0 }
        months[key].total += Number(d.total)
      })
      return Object.values(months)
    }
    return data.daily_totals.map(d => ({
      label: period === 'day'
        ? format(parseISO(d.date), 'EEEE', { locale: es })
        : format(parseISO(d.date), 'd MMM', { locale: es }),
      total: Number(d.total),
    }))
  }, [data, period])

  // Pie data: only methods with amount > 0
  const pieData = useMemo(() => {
    if (!data) return []
    return METHODS
      .map(m => ({ name: m.label, value: Number(data[m.key]), color: m.color }))
      .filter(d => d.value > 0)
  }, [data])

  const total       = Number(data?.total ?? 0)
  const orderCount  = data?.order_count ?? 0

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Ingresos"
        subtitle="Dinero cobrado por servicios entregados"
      />

      {/* Period tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              period === p
                ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                : 'bg-white/[0.04] text-gray-400 border border-white/8 hover:bg-white/[0.07]'
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {loading && <RefreshCw size={16} className="ml-auto text-gray-600 animate-spin self-center" />}
      </div>

      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            key={period}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* KPI row: total + order count */}
            <div className="grid grid-cols-2 gap-4">
              <GlassCard padding className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total cobrado</p>
                <p className="text-3xl font-bold text-yellow-400">{fmt(total)}</p>
                <p className="text-xs text-gray-600">{orderCount} {orderCount === 1 ? 'servicio entregado' : 'servicios entregados'}</p>
              </GlassCard>
              <GlassCard padding className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Por método de pago</p>
                {METHODS.map(m => {
                  const val = Number(data[m.key])
                  const pct = total > 0 ? Math.round((val / total) * 100) : 0
                  if (val === 0) return null
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                      <span className="text-xs text-gray-400 flex-1">{m.label}</span>
                      <span className="text-xs text-gray-300 font-medium">{fmt(val)}</span>
                      <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
                {total === 0 && <p className="text-xs text-gray-600">Sin ingresos en el período</p>}
              </GlassCard>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              {/* Bar chart */}
              <GlassCard padding>
                <h3 className="text-sm font-medium text-gray-400 mb-4">
                  {period === 'day'   && 'Hoy'}
                  {period === 'week'  && 'Esta semana — por día'}
                  {period === 'month' && 'Este mes — por día'}
                  {period === 'year'  && 'Este año — por mes'}
                </h3>
                {chartData.some(d => d.total > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} barGap={4}>
                      <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                        interval={period === 'month' ? 4 : 0} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmt(v as number), 'Total']} />
                      <Bar dataKey="total" fill="#eab308" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center">
                    <p className="text-sm text-gray-700">Sin ingresos en el período</p>
                  </div>
                )}
              </GlassCard>

              {/* Donut chart: method distribution */}
              <GlassCard padding>
                <h3 className="text-sm font-medium text-gray-400 mb-4">Distribución por cuenta</h3>
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          dataKey="value" paddingAngle={3}>
                          {pieData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmt(v as number), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-1">
                      {pieData.map(d => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            <span className="text-gray-400">{d.name}</span>
                          </div>
                          <span className="text-gray-300 font-medium">{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[160px] flex items-center justify-center">
                    <p className="text-sm text-gray-700">Sin datos</p>
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Method breakdown cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {METHODS.map(m => {
                const val = Number(data[m.key])
                const pct = total > 0 ? Math.round((val / total) * 100) : 0
                return (
                  <div key={m.key} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: m.color }}>{m.icon}</span>
                      <span className="text-xs text-gray-500">{m.label}</span>
                    </div>
                    <p className="text-lg font-bold text-white">{fmt(val)}</p>
                    <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: m.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-xs text-gray-700">{pct}% del total</p>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!data && !loading && (
        <div className="text-center py-16 text-gray-600">Sin datos para mostrar</div>
      )}
    </div>
  )
}
