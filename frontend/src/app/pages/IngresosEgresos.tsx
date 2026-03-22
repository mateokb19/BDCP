import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO, startOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Banknote, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { cn } from '@/app/components/ui/cn'
import { mockTransactions } from '@/data/mock'
import { api, type ApiIngresosResponse } from '@/api'
import type { TransactionType } from '@/types'

const TOOLTIP_STYLE = {
  contentStyle: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}

const PIE_COLORS = ['#eab308', '#3b82f6', '#8b5cf6', '#ef4444', '#22c55e', '#f97316']

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const rowAnim = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } }

type IngresosPeriod = 'day' | 'week' | 'month' | 'year'
const PERIOD_LABELS: Record<IngresosPeriod, string> = { day: 'Hoy', week: 'Semana', month: 'Mes', year: 'Año' }

const PAY_METHODS = [
  { key: 'payment_cash'        as const, label: 'Efectivo',    color: '#eab308', icon: <Banknote size={13} /> },
  { key: 'payment_datafono'    as const, label: 'Datáfono',    color: '#3b82f6', icon: <CreditCard size={13} /> },
  { key: 'payment_nequi'       as const, label: 'Nequi',       color: '#a855f7', icon: <CreditCard size={13} /> },
  { key: 'payment_bancolombia' as const, label: 'Bancolombia', color: '#ef4444', icon: <CreditCard size={13} /> },
]

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral' }) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const color = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
  return (
    <GlassCard padding className="space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-white">{value}</p>
        <Icon size={20} className={color} />
      </div>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </GlassCard>
  )
}

export default function IngresosEgresos() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all')
  const [catFilter,  setCatFilter]  = useState('all')
  const [dateStart,  setDateStart]  = useState('2026-02-01')
  const [dateEnd,    setDateEnd]    = useState('2026-03-18')

  // Real payment method distribution
  const [ingresosPeriod, setIngresosPeriod] = useState<IngresosPeriod>('month')
  const [ingresosData,   setIngresosData]   = useState<ApiIngresosResponse | null>(null)

  useEffect(() => {
    api.ingresos.get(ingresosPeriod)
      .then(setIngresosData)
      .catch(err => toast.error(err.message ?? 'Error al cargar ingresos'))
  }, [ingresosPeriod])

  const allTransactions = mockTransactions

  // Filtered for table
  const filtered = useMemo(() => allTransactions.filter(t => {
    const d  = parseISO(t.date)
    const ok = isWithinInterval(d, { start: parseISO(dateStart), end: parseISO(dateEnd) })
    return ok
      && (typeFilter === 'all' || t.type === typeFilter)
      && (catFilter  === 'all' || t.category === catFilter)
  }).sort((a, b) => b.date.localeCompare(a.date)), [typeFilter, catFilter, dateStart, dateEnd])

  // KPIs
  const totalIn  = filtered.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const totalOut = filtered.filter(t => t.type === 'egreso').reduce((s, t) => s + t.amount, 0)
  const balance  = totalIn - totalOut

  // BarChart: group by week
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string; ingresos: number; egresos: number }> = {}
    filtered.forEach(t => {
      const ws  = startOfWeek(parseISO(t.date), { weekStartsOn: 1 })
      const key = format(ws, 'dd MMM', { locale: es })
      if (!weeks[key]) weeks[key] = { week: key, ingresos: 0, egresos: 0 }
      if (t.type === 'ingreso') weeks[key].ingresos += t.amount
      else                      weeks[key].egresos  += t.amount
    })
    return Object.values(weeks)
  }, [filtered])

  // PieChart: egresos by category
  const pieData = useMemo(() => {
    const cats: Record<string, number> = {}
    filtered.filter(t => t.type === 'egreso').forEach(t => {
      const cat = t.category ?? 'Otros'
      cats[cat] = (cats[cat] ?? 0) + t.amount
    })
    return Object.entries(cats).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const categories = [...new Set(allTransactions.map(t => t.category).filter(Boolean))] as string[]

  const ingresosTotal = Number(ingresosData?.total ?? 0)

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Ingresos / Egresos" subtitle="Seguimiento financiero del negocio" />

      {/* ── Real payment method distribution ───────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-medium text-gray-300">Ingresos por método de pago</h3>
          <div className="flex gap-1.5">
            {(Object.keys(PERIOD_LABELS) as IngresosPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setIngresosPeriod(p)}
                className={cn(
                  'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                  ingresosPeriod === p
                    ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                    : 'bg-white/[0.04] text-gray-500 border border-white/8 hover:bg-white/[0.07]'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PAY_METHODS.map(m => {
            const val = Number(ingresosData?.[m.key] ?? 0)
            const pct = ingresosTotal > 0 ? Math.round((val / ingresosTotal) * 100) : 0
            return (
              <div key={m.key} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
                <p className="text-base font-bold text-white">
                  ${val.toLocaleString('es-CO')}
                </p>
                <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: m.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[11px] text-gray-700">{pct}% · {ingresosData?.order_count ?? 0} órdenes</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ingresos" value={`$${totalIn.toLocaleString()}`} trend="up" sub={`${filtered.filter(t => t.type === 'ingreso').length} transacciones`} />
        <KpiCard label="Egresos"  value={`$${totalOut.toLocaleString()}`} trend="down" sub={`${filtered.filter(t => t.type === 'egreso').length} transacciones`} />
        <KpiCard label="Balance Neto" value={`$${Math.abs(balance).toLocaleString()}`} trend={balance >= 0 ? 'up' : 'down'}
          sub={balance >= 0 ? 'Superávit' : 'Déficit'} />
        <KpiCard label="Transacciones" value={String(filtered.length)} trend="neutral" sub="en el período" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-6">
        <GlassCard padding>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Ingresos vs Egresos por semana</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barGap={4}>
              <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`$${v}`, '']} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar dataKey="ingresos" fill="#eab308" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos"  fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard padding>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Egresos por categoría</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`$${v}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-gray-300">${d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-gray-600 text-center mt-8">Sin egresos en el período</p>}
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-500/50 focus:outline-none" />
          <span className="hidden sm:inline text-gray-600">–</span>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-500/50 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {(['all', 'ingreso', 'egreso'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('rounded-xl px-3 py-1.5 text-sm transition-colors',
                typeFilter === t ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-gray-400 hover:bg-white/8')}>
              {t === 'all' ? 'Todos' : t === 'ingreso' ? '↑ Ingresos' : '↓ Egresos'}
            </button>
          ))}
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-500/50 focus:outline-none">
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-2 sm:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-2 sm:px-4 py-3 w-6" />
              <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
              <th className="text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Orden</th>
              <th className="text-right px-2 sm:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
            </tr>
          </thead>
          <motion.tbody variants={stagger} initial="hidden" animate="show">
            {filtered.map(t => (
              <motion.tr key={t.id} variants={rowAnim} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-2 sm:px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {format(parseISO(t.date), "d MMM yy", { locale: es })}
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <div className={cn('w-2.5 h-2.5 rounded-full mx-auto', t.type === 'ingreso' ? 'bg-green-400' : 'bg-red-400')} />
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-gray-400 text-xs">{t.category ?? '—'}</td>
                <td className="px-2 sm:px-4 py-3 text-gray-300 truncate max-w-[120px] sm:max-w-[260px] text-xs sm:text-sm">{t.description ?? '—'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs font-mono">
                  {t.order_id ? `#${t.order_id}` : '—'}
                </td>
                <td className={cn('px-2 sm:px-5 py-3 text-right font-semibold text-xs sm:text-sm whitespace-nowrap', t.type === 'ingreso' ? 'text-green-400' : 'text-red-400')}>
                  {t.type === 'ingreso' ? '+' : '-'}${t.amount}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-600 py-10 text-sm">Sin transacciones en el período seleccionado</p>
        )}
      </div>
    </div>
  )
}
