import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, ChevronLeft, Check, Download, Phone, CreditCard, Calendar, Pencil, UserX, UserCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/Button'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiLiqWeekResponse, type ApiDebt, type LiquidatePayload, type ApiReportResponse } from '@/api'
import type { Operator } from '@/types'

import {
  CORRECT_PASSWORD, parseCOP, getWeekStart,
  getInitials,
  OP_COLORS, OP_TYPE_STYLE,
} from './liquidacion/helpers'
import { buildReportHtml } from './liquidacion/reportTemplate'
import { LiquidarModal }  from './liquidacion/LiquidarModal'
import { ReportModals }   from './liquidacion/ReportModals'
import { WeekPanel }      from './liquidacion/WeekPanel'
import { DebtPanel }      from './liquidacion/DebtPanel'
import { OperatorGrid }   from './liquidacion/OperatorGrid'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LiquidacionPage() {
  const [unlocked,    setUnlocked]    = useState(false)
  const [pwd,         setPwd]         = useState('')
  const [shake,       setShake]       = useState(false)
  const [operators,   setOperators]   = useState<Operator[]>([])
  const [opsLoading,  setOpsLoading]  = useState(true)
  const [selectedOp,  setSelectedOp]  = useState<number | null>(null)
  const [weekOffset,  setWeekOffset]  = useState(0)
  const [weekData,    setWeekData]    = useState<ApiLiqWeekResponse | null>(null)
  const [weekLoading, setWeekLoading] = useState(false)
  const [debts,       setDebts]       = useState<ApiDebt[]>([])
  const [openDays,    setOpenDays]    = useState<Set<string>>(new Set())
  const [addDebtOpen, setAddDebtOpen] = useState(false)
  const [liquidarOpen, setLiquidarOpen] = useState(false)
  const [pendingData,  setPendingData]  = useState<ApiLiqWeekResponse | null>(null)
  const [pendingLoading, setPendingLoading] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [customMonthOpen, setCustomMonthOpen] = useState(false)
  const [customMonthValue, setCustomMonthValue] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [debtForm, setDebtForm] = useState({
    direction: 'empresa_operario' as 'empresa_operario' | 'operario_empresa',
    amount: '',
    description: '',
  })
  // New operator form
  const [newOpOpen,  setNewOpOpen]  = useState(false)
  const [newOpForm,  setNewOpForm]  = useState({ name: '', phone: '', cedula: '', commission_rate: '', operator_type: 'detallado' })
  const [newOpSaving, setNewOpSaving] = useState(false)
  // Edit commission
  const [editOpOpen,  setEditOpOpen]  = useState(false)
  const [editOpForm,  setEditOpForm]  = useState({ name: '', phone: '', cedula: '', commission_rate: '' })
  const [editOpSaving, setEditOpSaving] = useState(false)
  // Deactivate confirmation
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)

  useEffect(() => {
    if (!unlocked) return
    api.operators.list(true)
      .then(setOperators)
      .catch(() => toast.error('Error al cargar operarios'))
      .finally(() => setOpsLoading(false))
  }, [unlocked])

  useEffect(() => {
    if (selectedOp === null) return
    const ws = format(getWeekStart(weekOffset), 'yyyy-MM-dd')
    setWeekLoading(true)
    setWeekData(null)
    api.liquidation.getWeek(selectedOp, ws)
      .then(setWeekData)
      .catch(() => toast.error('Error al cargar datos de semana'))
      .finally(() => setWeekLoading(false))
  }, [selectedOp, weekOffset])

  useEffect(() => {
    if (selectedOp === null) return
    api.liquidation.listDebts(selectedOp)
      .then(setDebts)
      .catch(() => {})
  }, [selectedOp])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pwd === CORRECT_PASSWORD) {
      setUnlocked(true)
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      toast.error('Contraseña incorrecta')
      setPwd('')
    }
  }

  function toggleDay(dateStr: string) {
    setOpenDays(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  async function handleAddDebt() {
    if (!selectedOp || !debtForm.amount) return
    try {
      const debt = await api.liquidation.createDebt(selectedOp, {
        direction: debtForm.direction,
        amount: Number(debtForm.amount),
        description: debtForm.description || undefined,
      })
      setDebts(prev => [debt, ...prev])
      setDebtForm({ direction: 'empresa_operario', amount: '', description: '' })
      setAddDebtOpen(false)
      toast.success('Deuda registrada')
    } catch {
      toast.error('Error al registrar deuda')
    }
  }

  async function handleCreateOperator() {
    if (!newOpForm.name.trim()) return
    setNewOpSaving(true)
    try {
      const op = await api.operators.create({
        name: newOpForm.name.trim(),
        phone: newOpForm.phone.trim() || undefined,
        cedula: newOpForm.cedula.trim() || undefined,
        commission_rate: Number(parseCOP(newOpForm.commission_rate)) || 0,
        operator_type: newOpForm.operator_type,
      })
      setOperators(prev => [...prev, op])
      setNewOpForm({ name: '', phone: '', cedula: '', commission_rate: '', operator_type: 'detallado' })
      setNewOpOpen(false)
      toast.success(`Operario ${op.name} creado`)
    } catch {
      toast.error('Error al crear operario')
    } finally {
      setNewOpSaving(false)
    }
  }

  async function handleSaveOpEdit() {
    if (!selectedOp) return
    setEditOpSaving(true)
    try {
      const updated = await api.operators.update(selectedOp, {
        name:            editOpForm.name.trim() || undefined,
        phone:           editOpForm.phone.trim() || undefined,
        cedula:          editOpForm.cedula.trim() || undefined,
        commission_rate: Number(parseCOP(editOpForm.commission_rate)) || 0,
      })
      setOperators(prev => prev.map(o => o.id === updated.id ? updated : o))
      setEditOpOpen(false)
      toast.success('Operario actualizado')
    } catch {
      toast.error('Error al actualizar operario')
    } finally {
      setEditOpSaving(false)
    }
  }

  async function handleToggleActive(op: Operator) {
    const action = op.active ? false : true
    try {
      const updated = await api.operators.update(op.id, { active: action })
      setOperators(prev => prev.map(o => o.id === updated.id ? updated : o))
      setDeactivateConfirm(false)
      toast.success(action ? `${op.name} reactivado` : `${op.name} dado de baja`)
    } catch {
      toast.error('Error al actualizar operario')
    }
  }

  async function handleMarkPaid(debtId: number) {
    try {
      const updated = await api.liquidation.markDebtPaid(debtId)
      setDebts(prev => prev.map(d => d.id === debtId ? updated : d))
      toast.success('Marcada como pagada')
    } catch {
      toast.error('Error al actualizar deuda')
    }
  }

  async function handleLiquidate(payload: LiquidatePayload) {
    if (!selectedOp) return
    await api.liquidation.liquidatePending(selectedOp, payload)
    // Refresh week view and debts
    const ws = format(getWeekStart(weekOffset), 'yyyy-MM-dd')
    const [updatedWeek, updatedDebts] = await Promise.all([
      api.liquidation.getWeek(selectedOp, ws),
      api.liquidation.listDebts(selectedOp),
    ])
    setWeekData(updatedWeek)
    setPendingData(null)
    setDebts(updatedDebts)
    toast.success('Liquidación completada')
  }

  async function downloadReport(period: 'week' | 'month', refDate: string) {
    if (!selectedOp) return
    setReportModalOpen(false)
    try {
      const report = await api.liquidation.getReport(selectedOp, period, refDate)
      printReport(report)
    } catch {
      toast.error('Error al generar el reporte')
    }
  }

  async function downloadCustomMonth() {
    if (!selectedOp || !customMonthValue) return
    setCustomMonthOpen(false)
    try {
      const report = await api.liquidation.getReport(selectedOp, 'month', `${customMonthValue}-01`)
      printReport(report)
    } catch {
      toast.error('Error al generar el reporte')
    }
  }

  function printReport(r: ApiReportResponse) {
    const html = buildReportHtml(r)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (!win) { toast.error('Permite ventanas emergentes para descargar el PDF'); }
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  // ── Lock screen ─────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <GlassCard padding className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-yellow-500/10 p-4">
                <Lock size={36} className="text-yellow-400" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white">Acceso Restringido</h2>
                <p className="text-sm text-gray-500 mt-1">Ingresa la contraseña para ver la liquidación</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <motion.div
                animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                <input
                  type="password"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg text-gray-100 placeholder:text-gray-600 tracking-widest focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
                />
              </motion.div>
              <Button type="submit" variant="primary" size="lg" className="w-full">
                Ingresar
              </Button>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    )
  }

  // ── Operator detail ──────────────────────────────────────────────────────────
  if (selectedOp !== null) {
    const operator  = operators.find(o => o.id === selectedOp)
    const opIdx     = operator ? operators.indexOf(operator) : 0
    const opColor   = OP_COLORS[opIdx % OP_COLORS.length]
    const weekStart = getWeekStart(weekOffset)

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <ReportModals
          reportModalOpen={reportModalOpen}
          setReportModalOpen={setReportModalOpen}
          customMonthOpen={customMonthOpen}
          setCustomMonthOpen={setCustomMonthOpen}
          customMonthValue={customMonthValue}
          setCustomMonthValue={setCustomMonthValue}
          weekStart={weekStart}
          weekOffset={weekOffset}
          onDownload={downloadReport}
          onDownloadCustomMonth={downloadCustomMonth}
        />

        {/* Liquidar modal */}
        {operator && pendingData && (
          <LiquidarModal
            open={liquidarOpen}
            onClose={() => setLiquidarOpen(false)}
            operator={operator}
            weekData={pendingData}
            debts={debts}
            onConfirm={handleLiquidate}
          />
        )}

        {/* Back */}
        <button
          onClick={() => { setSelectedOp(null); setWeekData(null); setWeekOffset(0); setDebts([]); setDeactivateConfirm(false); setEditOpOpen(false) }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <ChevronLeft size={16} /> Operarios
        </button>

        {/* Operator header */}
        {operator && (
          <GlassCard padding className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn('rounded-2xl p-3 text-lg sm:text-2xl font-bold leading-none min-w-[48px] sm:min-w-[56px] text-center shrink-0', operator.active ? `${opColor.bg} ${opColor.text}` : 'bg-gray-800 text-gray-500')}>
                  {getInitials(operator.name)}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-xl font-semibold text-white leading-snug">{operator.name}</h2>
                    {(() => { const t = OP_TYPE_STYLE[operator.operator_type] ?? OP_TYPE_STYLE.detallado; return (
                      <span className={cn('text-[10px] border rounded px-1.5 py-0.5', t.cls)}>{t.label}</span>
                    )})()}
                    {!operator.active && (
                      <span className="text-[10px] border border-gray-600 text-gray-500 rounded px-1.5 py-0.5">Inactivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(operator.operator_type ?? 'detallado') === 'detallado' && (
                      <p className="text-xs sm:text-sm text-gray-500">Comisión {Number(operator.commission_rate)}%</p>
                    )}
                    <button
                      onClick={() => { setEditOpForm({ name: operator.name, phone: operator.phone ?? '', cedula: operator.cedula ?? '', commission_rate: String(Number(operator.commission_rate)) }); setEditOpOpen(v => !v) }}
                      className="p-0.5 rounded hover:bg-white/10 text-gray-600 hover:text-yellow-400 transition-colors"
                      title="Editar operario"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={10} />
                      {operator.phone || '—'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <CreditCard size={10} />
                      {operator.cedula || '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 sm:px-3 sm:py-2 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
                >
                  <Download size={15} />
                  <span className="hidden sm:inline text-sm">Descargar</span>
                </button>
                <button
                  onClick={() => setCustomMonthOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 sm:px-3 sm:py-2 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
                  title="Factura de otro mes"
                >
                  <Calendar size={15} />
                  <span className="hidden sm:inline text-sm">Otro mes</span>
                </button>
              </div>
            </div>

            {/* Edit operator inline */}
            <AnimatePresence>
              {editOpOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pt-3 border-t border-white/8 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">Nombre</label>
                        <input type="text" value={editOpForm.name}
                          onChange={e => setEditOpForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none"
                          autoFocus />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">Teléfono</label>
                        <input type="text" inputMode="tel" value={editOpForm.phone}
                          onChange={e => setEditOpForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">Cédula</label>
                        <input type="text" value={editOpForm.cedula}
                          onChange={e => setEditOpForm(f => ({ ...f, cedula: e.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none" />
                      </div>
                      {(operator.operator_type ?? 'detallado') === 'detallado' && (
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Comisión (%)</label>
                          <div className="relative">
                            <input type="text" inputMode="numeric" value={editOpForm.commission_rate}
                              onChange={e => setEditOpForm(f => ({ ...f, commission_rate: e.target.value.replace(/[^\d]/g, '') }))}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-6 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none"
                              placeholder="30" />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditOpOpen(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                      <Button variant="primary" size="sm" onClick={handleSaveOpEdit} disabled={editOpSaving}>
                        {editOpSaving ? 'Guardando...' : <><Check size={13} /> Guardar</>}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Deactivate / Reactivate */}
            <div className="border-t border-white/8 pt-3">
              {!deactivateConfirm ? (
                <button
                  onClick={() => operator.active ? setDeactivateConfirm(true) : handleToggleActive(operator)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-colors',
                    operator.active ? 'text-red-500/70 hover:text-red-400' : 'text-green-500/70 hover:text-green-400'
                  )}
                >
                  {operator.active ? <><UserX size={13} /> Dar de baja a {operator.name}</> : <><UserCheck size={13} /> Reactivar a {operator.name}</>}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-red-400">¿Confirmar baja de {operator.name}?</p>
                  <button onClick={() => handleToggleActive(operator)} className="text-xs text-red-400 hover:text-red-300 font-semibold">Sí, dar de baja</button>
                  <button onClick={() => setDeactivateConfirm(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancelar</button>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        <WeekPanel
          weekData={weekData}
          weekLoading={weekLoading}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          openDays={openDays}
          toggleDay={toggleDay}
          pendingLoading={pendingLoading}
          noPending={pendingData !== null && pendingData.unliquidated_count === 0}
          onLiquidarClick={async () => {
            if (!selectedOp) return
            setPendingLoading(true)
            try {
              const data = await api.liquidation.getPending(selectedOp)
              setPendingData(data)
              if (data.unliquidated_count === 0) {
                toast.info('No hay servicios pendientes por liquidar')
              } else {
                setLiquidarOpen(true)
              }
            } catch {
              toast.error('Error al cargar servicios pendientes')
            } finally {
              setPendingLoading(false)
            }
          }}
        />

        <DebtPanel
          debts={debts}
          selectedOp={selectedOp}
          addDebtOpen={addDebtOpen}
          setAddDebtOpen={setAddDebtOpen}
          debtForm={debtForm}
          setDebtForm={setDebtForm}
          onAddDebt={handleAddDebt}
          onMarkPaid={handleMarkPaid}
        />
      </div>
    )
  }

  // ── Operator grid ────────────────────────────────────────────────────────────
  return (
    <OperatorGrid
      operators={operators}
      opsLoading={opsLoading}
      onSelect={(id) => { setSelectedOp(id); setWeekOffset(0) }}
      newOpOpen={newOpOpen}
      setNewOpOpen={setNewOpOpen}
      newOpForm={newOpForm}
      setNewOpForm={setNewOpForm}
      newOpSaving={newOpSaving}
      onCreateOperator={handleCreateOperator}
    />
  )
}
