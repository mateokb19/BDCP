import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Banknote, CreditCard, Plus, Trash2, X, Car } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { Button } from '@/app/components/ui/Button'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiIngresosResponse, type ApiExpense, type ApiIngresoBreakdownItem } from '@/api'

// ── Constants ────────────────────────────────────────────────────────────────

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

function getPeriodDates(period: IngresosPeriod): { start: string; end: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (period === 'day') {
    const s = ymd(now); return { start: s, end: s }
  }
  if (period === 'week') {
    const sun = new Date(now); sun.setDate(now.getDate() - now.getDay())
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6)
    return { start: ymd(sun), end: ymd(sat) }
  }
  if (period === 'year') {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: ymd(first), end: ymd(last) }
}

const PAY_METHODS = [
  { key: 'payment_cash'        as const, label: 'Efectivo',    color: '#eab308', icon: <Banknote size={13} /> },
  { key: 'payment_datafono'    as const, label: 'Datáfono',    color: '#3b82f6', icon: <CreditCard size={13} /> },
  { key: 'payment_nequi'       as const, label: 'Nequi',       color: '#a855f7', icon: <CreditCard size={13} /> },
  { key: 'payment_bancolombia' as const, label: 'Bancolombia', color: '#ef4444', icon: <CreditCard size={13} /> },
]

const EXPENSE_CATEGORIES = [
  'Insumos', 'Servicios públicos', 'Arriendo', 'Equipos y herramientas',
  'Marketing', 'Salarios', 'Transporte', 'Otros',
]

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IngresosEgresos() {
  // Income (real data)
  const [ingresosPeriod, setIngresosPeriod] = useState<IngresosPeriod>('month')
  const [ingresosData,   setIngresosData]   = useState<ApiIngresosResponse | null>(null)

  // Expenses (real data)
  const [expenses,  setExpenses]  = useState<ApiExpense[]>([])
  const [dateStart, setDateStart] = useState(() => getPeriodDates('month').start)
  const [dateEnd,   setDateEnd]   = useState(() => getPeriodDates('month').end)

  // Breakdown modal
  const [breakdown,      setBreakdown]      = useState<ApiIngresoBreakdownItem[] | null>(null)
  const [breakdownMethod,setBreakdownMethod]= useState<typeof PAY_METHODS[number] | null>(null)
  const [loadingBreakdown,setLoadingBreakdown] = useState(false)

  async function openBreakdown(m: typeof PAY_METHODS[number]) {
    setBreakdownMethod(m)
    setBreakdown(null)
    setLoadingBreakdown(true)
    try {
      const items = await api.ingresos.breakdown(m.key.replace('payment_', ''), dateStart, dateEnd)
      setBreakdown(items)
    } catch {
      toast.error('No se pudo cargar el desglose')
    } finally {
      setLoadingBreakdown(false)
    }
  }

  // New expense modal
  const [showModal,   setShowModal]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [newExpense,  setNewExpense]  = useState({
    date:           new Date().toISOString().slice(0, 10),
    amount:         '',
    category:       '',
    description:    '',
    payment_method: '',
  })

  // Load income + sync expense date range when period changes
  useEffect(() => {
    api.ingresos.get(ingresosPeriod)
      .then(setIngresosData)
      .catch(err => toast.error(err.message ?? 'Error al cargar ingresos'))
    const { start, end } = getPeriodDates(ingresosPeriod)
    setDateStart(start)
    setDateEnd(end)
  }, [ingresosPeriod])

  // Load expenses
  useEffect(() => {
    api.egresos.list({ date_start: dateStart, date_end: dateEnd })
      .then(setExpenses)
      .catch(err => toast.error(err.message ?? 'Error al cargar egresos'))
  }, [dateStart, dateEnd])

  async function saveExpense() {
    if (!newExpense.amount || Number(newExpense.amount) <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    setSaving(true)
    try {
      const created = await api.egresos.create({
        date:           newExpense.date,
        amount:         Number(newExpense.amount),
        category:       newExpense.category       || undefined,
        description:    newExpense.description    || undefined,
        payment_method: newExpense.payment_method || undefined,
      })
      setExpenses(prev => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
      toast.success('Egreso registrado')
      setShowModal(false)
      setNewExpense({ date: new Date().toISOString().slice(0, 10), amount: '', category: '', description: '', payment_method: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExpense(id: number) {
    try {
      await api.egresos.delete(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
      toast.success('Egreso eliminado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  // Derived values
  const ingresosTotal = Number(ingresosData?.total ?? 0)
  const egresosTotal  = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const balance       = ingresosTotal - egresosTotal

  // Bar chart: egresos by category
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    expenses.forEach(e => {
      const cat = e.category ?? 'Otros'
      cats[cat] = (cats[cat] ?? 0) + Number(e.amount)
    })
    return Object.entries(cats).map(([name, value]) => ({ name, value }))
  }, [expenses])

  // Combined chart: ingresos + egresos grouped by period granularity
  const chartData = useMemo(() => {
    if (!ingresosData) return []
    const expByDate: Record<string, number> = {}
    expenses.forEach(e => { expByDate[e.date] = (expByDate[e.date] ?? 0) + Number(e.amount) })

    if (ingresosPeriod === 'year') {
      const months: Record<string, { label: string; ingresos: number; egresos: number }> = {}
      ingresosData.daily_totals.forEach(d => {
        const key   = d.date.slice(0, 7)
        const label = format(parseISO(d.date), 'MMM', { locale: es })
        if (!months[key]) months[key] = { label, ingresos: 0, egresos: 0 }
        months[key].ingresos += Number(d.total)
        months[key].egresos  += expByDate[d.date] ?? 0
      })
      return Object.values(months)
    }

    return ingresosData.daily_totals.map(d => ({
      label: ingresosPeriod === 'week'
        ? format(parseISO(d.date), 'EEE', { locale: es })
        : ingresosPeriod === 'day'
        ? format(parseISO(d.date), 'EEEE', { locale: es })
        : format(parseISO(d.date), 'd MMM', { locale: es }),
      ingresos: Number(d.total),
      egresos:  expByDate[d.date] ?? 0,
    }))
  }, [ingresosData, expenses, ingresosPeriod])

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 placeholder:text-gray-600"

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Ingresos / Egresos" subtitle="Seguimiento financiero del negocio" />

      {/* ── Income by payment method ─────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-medium text-gray-300">Ingresos por método de pago</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Total: <span className="text-yellow-400 font-semibold">${ingresosTotal.toLocaleString('es-CO')}</span>
              {ingresosData && <span className="ml-2">· {ingresosData.order_count} {ingresosData.order_count === 1 ? 'orden' : 'órdenes'}</span>}
            </p>
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(PERIOD_LABELS) as IngresosPeriod[]).map(p => (
              <button key={p} onClick={() => setIngresosPeriod(p)}
                className={cn(
                  'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                  ingresosPeriod === p
                    ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                    : 'bg-white/[0.04] text-gray-500 border border-white/8 hover:bg-white/[0.07]'
                )}>
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
              <button
                key={m.key}
                type="button"
                onClick={() => openBreakdown(m)}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 space-y-1.5 text-left hover:bg-white/[0.06] hover:border-white/15 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: m.color }}>{m.icon}</span>
                    <span className="text-xs text-gray-500">{m.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-700 group-hover:text-gray-500 transition-colors">Ver desglose →</span>
                </div>
                <p className="text-base font-bold text-white">${val.toLocaleString('es-CO')}</p>
                <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: m.color }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }} />
                </div>
                <p className="text-[11px] text-gray-700">{pct}% del total</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Ingresos" value={`$${ingresosTotal.toLocaleString('es-CO')}`} trend="up"
          sub={`${PERIOD_LABELS[ingresosPeriod].toLowerCase()} · ${ingresosData?.order_count ?? 0} órdenes`} />
        <KpiCard label="Egresos" value={`$${egresosTotal.toLocaleString('es-CO')}`} trend="down"
          sub={`${expenses.length} ${expenses.length === 1 ? 'egreso' : 'egresos'} registrados`} />
        <KpiCard
          label="Balance"
          value={`$${Math.abs(balance).toLocaleString('es-CO')}`}
          trend={balance >= 0 ? 'up' : 'down'}
          sub={balance >= 0 ? 'Superávit' : 'Déficit'}
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-6">
        <GlassCard padding>
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Ingresos vs Egresos
            {' · '}
            <span className="text-gray-600">
              {ingresosPeriod === 'day' ? 'hoy' : ingresosPeriod === 'week' ? 'por día' : ingresosPeriod === 'month' ? 'por día' : 'por mes'}
            </span>
          </h3>
          {chartData.some(d => d.ingresos > 0 || d.egresos > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={3}>
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                  interval={ingresosPeriod === 'month' ? 4 : 0} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Bar dataKey="ingresos" fill="#eab308" radius={[4, 4, 0, 0]} />
                <Bar dataKey="egresos"  fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm text-gray-700">Sin datos en el período</p>
            </div>
          )}
        </GlassCard>

        <GlassCard padding>
          <h3 className="text-sm font-medium text-gray-400 mb-4">Egresos por categoría</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-gray-300">${Number(d.value).toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-gray-600 text-center mt-8">Sin egresos en el período</p>}
        </GlassCard>
      </div>

      {/* ── Expenses table ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-500/50 focus:outline-none" />
          <span className="hidden sm:inline text-gray-600">–</span>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 focus:border-yellow-500/50 focus:outline-none" />
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Nuevo Egreso
        </Button>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
              <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <motion.tbody variants={stagger} initial="hidden" animate="show">
            {expenses.map(e => (
              <motion.tr key={e.id} variants={rowAnim} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {format(parseISO(e.date), "d MMM yyyy", { locale: es })}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{e.category ?? '—'}</td>
                <td className="px-4 py-3 text-gray-300 text-xs sm:text-sm truncate max-w-[180px]">{e.description ?? '—'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-500">{e.payment_method ?? '—'}</td>
                <td className="px-5 py-3 text-right font-semibold text-red-400 text-sm whitespace-nowrap">
                  −${Number(e.amount).toLocaleString('es-CO')}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteExpense(e.id)}
                    className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
        {expenses.length === 0 && (
          <p className="text-center text-gray-600 py-10 text-sm">Sin egresos en el período seleccionado</p>
        )}
      </div>

      {/* ── New expense modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-4"
            >
              <h3 className="text-base font-semibold text-white">Nuevo Egreso</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Fecha *</label>
                  <input type="date" value={newExpense.date}
                    onChange={e => setNewExpense(f => ({ ...f, date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Monto *</label>
                  <input type="number" min="0" placeholder="0" value={newExpense.amount}
                    onChange={e => setNewExpense(f => ({ ...f, amount: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Categoría</label>
                  <select value={newExpense.category}
                    onChange={e => setNewExpense(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none">
                    <option value="" className="bg-gray-800 text-gray-400">Sin categoría</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-gray-800">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Método de pago</label>
                  <select value={newExpense.payment_method}
                    onChange={e => setNewExpense(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none">
                    <option value="" className="bg-gray-800 text-gray-400">Sin especificar</option>
                    <option value="Efectivo"      className="bg-gray-800">Efectivo</option>
                    <option value="Nequi"         className="bg-gray-800">Nequi</option>
                    <option value="Bancolombia"   className="bg-gray-800">Bancolombia</option>
                    <option value="Datáfono"      className="bg-gray-800">Banco Caja Social</option>
                    <option value="Transferencia" className="bg-gray-800">Transferencia</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Descripción</label>
                  <input type="text" placeholder="¿En qué se gastó?" value={newExpense.description}
                    onChange={e => setNewExpense(f => ({ ...f, description: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="md" className="flex-1" onClick={saveExpense} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Egreso'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Breakdown modal ───────────────────────────────── */}
      <AnimatePresence>
        {breakdownMethod && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { setBreakdownMethod(null); setBreakdown(null) }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <span style={{ color: breakdownMethod.color }}>{breakdownMethod.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{breakdownMethod.label}</h3>
                    <p className="text-xs text-gray-500">
                      {dateStart === dateEnd ? dateStart : `${dateStart} · ${dateEnd}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setBreakdownMethod(null); setBreakdown(null) }}
                  className="rounded-lg p-1.5 text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1">
                {loadingBreakdown ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-gray-500">Cargando...</p>
                  </div>
                ) : !breakdown || breakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Car size={28} className="text-gray-700" />
                    <p className="text-sm text-gray-600">Sin pagos con este método en el período</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/6">
                    {breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-gray-500">{item.order_number}</span>
                            {item.is_abono && (
                              <span className="rounded-full bg-orange-500/15 border border-orange-500/25 px-1.5 py-0.5 text-[10px] text-orange-400">Abono</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-200 truncate mt-0.5">
                            {item.plate} · {item.vehicle}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-600">{item.client}</span>
                            <span className="text-xs text-gray-700">
                              {new Date(item.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-bold shrink-0" style={{ color: breakdownMethod.color }}>
                          ${Number(item.amount).toLocaleString('es-CO')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer total */}
              {breakdown && breakdown.length > 0 && (
                <div className="border-t border-white/8 px-5 py-3 flex items-center justify-between bg-white/[0.02]">
                  <span className="text-xs text-gray-500">{breakdown.length} {breakdown.length === 1 ? 'pago' : 'pagos'}</span>
                  <span className="text-sm font-bold text-white">
                    Total: ${breakdown.reduce((s, i) => s + Number(i.amount), 0).toLocaleString('es-CO')}
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
