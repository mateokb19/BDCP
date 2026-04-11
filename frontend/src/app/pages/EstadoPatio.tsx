import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiPatioEntry } from '@/api'
import { useAppContext } from '@/app/context/AppContext'

import { PatioCard }           from './estadoPatio/PatioCard'
import { EditOrderModal }      from './estadoPatio/EditOrderModal'
import { DeliveryModal }       from './estadoPatio/DeliveryModal'
import { OperatorPickerModal } from './estadoPatio/OperatorPickerModal'
import { MinimapPanel }        from './estadoPatio/MinimapPanel'
import type { FacturaRecord, EditForm } from './estadoPatio/types'
import { COLUMNS, CAT_TO_OP_TYPE, NO_OPERATOR_TYPES, FACTURA_KEY } from './estadoPatio/constants'
import { loadFacturas, loadChecklist, saveChecklist } from './estadoPatio/utils'

export default function EstadoPatio() {
  const { operators, services } = useAppContext()

  const [entries,        setEntries]        = useState<ApiPatioEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [facturaRecords, setFacturaRecords] = useState<Record<number, FacturaRecord>>(loadFacturas)

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editingEntry,  setEditingEntry]  = useState<ApiPatioEntry | null>(null)
  const [editForm,      setEditForm]      = useState<EditForm>({
    serviceIds: [], customPrices: {}, operatorByType: {}, latOperatorPays: {},
  })
  const [openCats,      setOpenCats]      = useState<Set<string>>(new Set())
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editOperators, setEditOperators] = useState<typeof operators>([])

  // ── Operator picker modal (esperando → en_proceso) ──────────────────────────
  const [operatorPickEntry, setOperatorPickEntry] = useState<ApiPatioEntry | null>(null)
  const [pickedOpId,        setPickedOpId]        = useState('')
  const [entryNotes,        setEntryNotes]        = useState('')
  const [picking,           setPicking]           = useState(false)
  const [activeOperators] = useState(
    operators.filter(o => (o.operator_type ?? 'detallado') === 'detallado')
  )

  // ── Delivery / payment modal (listo → entregado) ───────────────────────────
  const [paymentEntry,  setPaymentEntry]  = useState<ApiPatioEntry | null>(null)
  const [payMethods,    setPayMethods]    = useState<Record<string, string>>({})
  const [delivering,    setDelivering]    = useState(false)
  const [applyIva,      setApplyIva]      = useState(false)
  const [deliveryOpId,  setDeliveryOpId]  = useState('')
  const [deliveryOps,   setDeliveryOps]   = useState<typeof operators>([])
  const [factura,       setFactura]       = useState(false)
  const [facturaData,   setFacturaData]   = useState<FacturaRecord>({
    tipo: 'persona_natural', id_type: 'CC', id_number: '', dv: '', name: '', phone: '', email: '',
  })

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.patio.list()
      .then(setEntries)
      .catch(err => toast.error(err.message ?? 'Error al cargar el patio'))
      .finally(() => setLoading(false))
  }, [])

  // Re-fetch when the user returns to the tab (handles stale data after long absence)
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) {
        api.patio.list().then(setEntries).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Re-fetch at midnight to drop yesterday's delivered entries from the kanban
  useEffect(() => {
    let currentDate = new Date().toDateString()
    const interval  = setInterval(() => {
      const now = new Date().toDateString()
      if (now !== currentDate) {
        currentDate = now
        api.patio.list().then(setEntries).catch(() => {})
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  // ── Edit modal handlers ─────────────────────────────────────────────────────
  async function openEdit(entry: ApiPatioEntry) {
    const items       = entry.order?.items ?? []
    const selectedIds = items.map(i => i.service_id).filter((id): id is number => id != null)

    const prices: Record<number, string> = {}
    items.forEach(i => { if (i.service_id != null) prices[i.service_id] = String(Number(i.unit_price)) })

    const allOps    = await api.operators.list().catch(() => [] as typeof operators)
    const activeOps = allOps.filter(o => o.active !== false)
    setEditOperators(activeOps)

    // Pre-fill operator by type from the current order operator
    const opByType: Record<string, string> = {}
    if (entry.order?.operator_id) {
      const currentOp = activeOps.find(o => o.id === entry.order!.operator_id)
      if (currentOp) {
        opByType[currentOp.operator_type ?? 'detallado'] = String(currentOp.id)
      }
    }
    // Auto-assign types that have exactly one candidate
    const opTypes = new Set(selectedIds.map(id => {
      const svc = services.find(s => s.id === id)
      const cat = svc?.category ?? items.find(i => i.service_id === id)?.service_category
      return cat ? CAT_TO_OP_TYPE[cat] : null
    }).filter(Boolean) as string[])
    for (const t of opTypes) {
      if (!opByType[t]) {
        const candidates = activeOps.filter(o => (o.operator_type ?? 'detallado') === t)
        if (candidates.length === 1) opByType[t] = String(candidates[0].id)
      }
    }

    // Pre-fill latonería operator pays
    const latItems = items.filter(i => i.service_category === 'latoneria' && i.service_id != null)
    const latPays:  Record<number, string> = {}
    for (const item of latItems) {
      const perItemPay = Number(item.latoneria_operator_pay ?? 0)
      if (perItemPay > 0) {
        latPays[item.service_id!] = String(perItemPay)
      } else {
        const itemPrice = Number(item.unit_price ?? 0)
        if (itemPrice > 0) latPays[item.service_id!] = String(itemPrice)
      }
    }

    setEditForm({ serviceIds: selectedIds, customPrices: prices, operatorByType: opByType, latOperatorPays: latPays })
    setOpenCats(new Set())
    setConfirmCancel(false)
    setEditingEntry(entry)
  }

  async function saveEdit() {
    if (!editingEntry) return
    const canEdit = editingEntry.status === 'esperando' || editingEntry.status === 'en_proceso'
    if (canEdit && editForm.serviceIds.length === 0) {
      setConfirmCancel(true)
      return
    }
    // Operator is optional in edit mode — assigned at delivery
    try {
      const overrides = editForm.serviceIds
        .filter(id => editForm.customPrices[id] != null)
        .map(id => ({ service_id: id, unit_price: Number(editForm.customPrices[id].replace(/\D/g, '')) }))

      const latPayEntries = Object.entries(editForm.latOperatorPays)
        .filter(([, v]) => Number(v.replace(/\D/g, '')) > 0)
        .map(([svcId, v]) => ({ service_id: Number(svcId), amount: Number(v.replace(/\D/g, '')) }))

      const payload: Parameters<typeof api.patio.edit>[1] = {}
      if (canEdit) {
        payload.service_ids = editForm.serviceIds
        if (overrides.length > 0) payload.item_overrides = overrides
      }
      if (latPayEntries.length > 0) payload.latoneria_operator_pays = latPayEntries

      // Priority: detallado operator > first type with an assigned operator
      const detOpId      = editForm.operatorByType['detallado']
      const fallbackOpId = Object.values(editForm.operatorByType).find(v => v)
      const newOpId      = detOpId ? Number(detOpId) : fallbackOpId ? Number(fallbackOpId) : null
      const currentOpId  = editingEntry.order?.operator_id ?? null
      if (newOpId !== currentOpId) payload.operator_id = newOpId

      const updated = await api.patio.edit(editingEntry.id, payload)
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

  // ── Status advance ──────────────────────────────────────────────────────────
  async function advanceStatus(entry: ApiPatioEntry) {
    if (entry.status === 'esperando') {
      const categories     = (entry.order?.items ?? []).map(i => i.service_category)
      // Auto-assign single-candidate specialist operators (latonería/pintura)
      const specialistTypes = [...new Set(
        categories
          .map(c => CAT_TO_OP_TYPE[c] ?? 'detallado')
          .filter(t => t !== 'detallado' && !NO_OPERATOR_TYPES.has(t))
      )]
      if (specialistTypes.length > 0 && !entry.order?.operator_id) {
        const allOps    = await api.operators.list().catch(() => [] as typeof operators)
        const activeOps = allOps.filter(o => o.active !== false)
        for (const t of specialistTypes) {
          const candidates = activeOps.filter(o => (o.operator_type ?? 'detallado') === t)
          if (candidates.length === 1) {
            await api.patio.edit(entry.id, { operator_id: candidates[0].id }).catch(() => {})
            break
          }
        }
      }
      try {
        const updated = await api.patio.advance(entry.id)
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
        toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → En Proceso`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al iniciar proceso')
      }
      return
    }

    // listo → entregado: intercept with payment modal
    if (entry.status === 'listo') {
      if (entry.scheduled_delivery_at) {
        const scheduledDate = format(parseISO(entry.scheduled_delivery_at), 'dd/MM/yyyy')
        const today         = format(new Date(), 'dd/MM/yyyy')
        if (scheduledDate !== today) {
          toast.warning(`Este vehículo estaba programado para entregarse el ${scheduledDate}`)
        }
      }
      const DETALLADO_CATS_SET = new Set(['exterior', 'interior', 'ceramico', 'correccion_pintura'])
      const hasDetallado       = (entry.order?.items ?? []).some(i => DETALLADO_CATS_SET.has(i.service_category))
      if (hasDetallado) {
        const allOps  = await api.operators.list().catch(() => [] as typeof operators)
        const detOps  = allOps.filter(o => o.active !== false && (o.operator_type ?? 'detallado') === 'detallado')
        setDeliveryOps(detOps)
        // Only pre-select if the existing operator is actually a detallado op
        const existingDetId = entry.order?.operator_id
          ? detOps.find(o => o.id === entry.order!.operator_id) ? String(entry.order.operator_id) : ''
          : ''
        setDeliveryOpId(existingDetId || (detOps.length === 1 ? String(detOps[0].id) : ''))
      } else {
        setDeliveryOps([])
        setDeliveryOpId('')
      }
      setPaymentEntry(entry)
      setPayMethods({})
      setApplyIva(false)
      const savedClient    = entry.vehicle?.client
      const hasSavedFactura = !!(savedClient?.tipo_persona && savedClient?.identificacion)
      setFactura(hasSavedFactura)
      setFacturaData({
        tipo:      (savedClient?.tipo_persona as 'persona_natural' | 'empresa') ?? 'persona_natural',
        id_type:   savedClient?.tipo_identificacion ?? 'CC',
        id_number: savedClient?.identificacion ?? '',
        dv:        savedClient?.dv ?? '',
        name:      savedClient?.name  ?? '',
        phone:     savedClient?.phone ?? '',
        email:     savedClient?.email ?? '',
      })
      return
    }

    try {
      const updated = await api.patio.advance(entry.id)
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      if (entry.status === 'en_proceso') {
        const all = loadChecklist()
        delete all[entry.order_id]
        saveChecklist(all)
      }
      const label = COLUMNS.find(c => c.status === updated.status)?.label
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} → ${label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar estado')
    }
  }

  // ── Delivery confirmation ───────────────────────────────────────────────────
  async function confirmDelivery() {
    if (!paymentEntry) return
    const restante           = Math.max(0, Number(paymentEntry.order?.total ?? 0) - Number(paymentEntry.order?.downpayment ?? 0))
    const DETALLADO_CATS     = new Set(['exterior', 'interior', 'ceramico', 'correccion_pintura'])
    const nonDetailladoTotal = (paymentEntry.order?.items ?? [])
      .filter(i => !DETALLADO_CATS.has(i.service_category))
      .reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)
    const ivaAmt             = Math.round(nonDetailladoTotal * 0.19)
    const effectiveRestante  = applyIva ? restante + ivaAmt : restante

    const keyToField: Record<string, 'payment_cash' | 'payment_datafono' | 'payment_nequi' | 'payment_bancolombia'> = {
      cash: 'payment_cash', datafono: 'payment_datafono', nequi: 'payment_nequi', bancolombia: 'payment_bancolombia',
    }
    const payment    = { payment_cash: 0, payment_datafono: 0, payment_nequi: 0, payment_bancolombia: 0 }
    const checkedKeys = Object.keys(payMethods)
    if (checkedKeys.length === 1) {
      payment[keyToField[checkedKeys[0]]] = effectiveRestante
    } else {
      for (const k of checkedKeys) payment[keyToField[k]] = Number(payMethods[k]) || 0
    }

    setDelivering(true)
    try {
      if (deliveryOpId) {
        await api.patio.edit(paymentEntry.id, { operator_id: Number(deliveryOpId) })
      }
      const updated = await api.patio.advance(paymentEntry.id, { ...payment })
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      if (factura && facturaData.id_number && paymentEntry.order?.id) {
        const next = { ...facturaRecords, [paymentEntry.order.id]: facturaData }
        setFacturaRecords(next)
        localStorage.setItem(FACTURA_KEY, JSON.stringify(next))
        const clientId = paymentEntry.vehicle?.client?.id
        if (clientId) {
          api.clients.patch(clientId, {
            tipo_persona:        facturaData.tipo,
            tipo_identificacion: facturaData.id_type,
            identificacion:      facturaData.id_number,
            dv:                  facturaData.dv || undefined,
            email:               facturaData.email || undefined,
          }).catch(() => {})
        }
      }
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} entregado`)
      setPaymentEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al entregar')
    } finally {
      setDelivering(false)
    }
  }

  // ── Credit delivery (client owes the remaining balance) ────────────────────
  async function confirmCreditDelivery() {
    if (!paymentEntry) return
    setDelivering(true)
    try {
      if (deliveryOpId) {
        await api.patio.edit(paymentEntry.id, { operator_id: Number(deliveryOpId) })
      }
      // Advance with is_client_credit flag — backend marks order as credit (not paid)
      const updated = await api.patio.advance(paymentEntry.id, { is_client_credit: true })
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
      toast.success(`${updated.vehicle?.plate ?? 'Vehículo'} entregado (deuda pendiente)`)
      setPaymentEntry(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al entregar')
    } finally {
      setDelivering(false)
    }
  }

  // ── Operator picker confirmation ────────────────────────────────────────────
  async function confirmAdvanceWithOperator() {
    if (!operatorPickEntry || !pickedOpId) return
    setPicking(true)
    try {
      await api.patio.edit(operatorPickEntry.id, { operator_id: Number(pickedOpId), notes: entryNotes || null })
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

  function togglePayMethod(key: string) {
    setPayMethods(prev => {
      const next = { ...prev }
      if (key in next) delete next[key]
      else next[key] = ''
      return next
    })
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = COLUMNS.map(col => ({
    ...col,
    count: entries.filter(e => e.status === col.status).length,
  }))

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

      {/* Kanban + Minimap */}
      <div className="flex gap-4 items-start">
        <LayoutGroup>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
                            facturaRecord={entry.order?.id != null ? facturaRecords[entry.order.id] : undefined}
                            onAdvance={advanceStatus}
                            onEdit={openEdit}
                            onUpdate={updated => setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))}
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

        <MinimapPanel entries={entries} />
      </div>

      {/* ── Edit Order Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingEntry && (
          <EditOrderModal
            editingEntry={editingEntry}
            onClose={() => setEditingEntry(null)}
            editForm={editForm}
            setEditForm={setEditForm}
            openCats={openCats}
            setOpenCats={setOpenCats}
            confirmCancel={confirmCancel}
            setConfirmCancel={setConfirmCancel}
            editOperators={editOperators}
            services={services}
            onSave={saveEdit}
            onCancelEntry={confirmCancelEntry}
          />
        )}
      </AnimatePresence>

      {/* ── Delivery / Payment Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {paymentEntry && (
          <DeliveryModal
            paymentEntry={paymentEntry}
            onClose={() => setPaymentEntry(null)}
            payMethods={payMethods}
            setPayMethods={setPayMethods}
            togglePayMethod={togglePayMethod}
            delivering={delivering}
            applyIva={applyIva}
            setApplyIva={setApplyIva}
            deliveryOpId={deliveryOpId}
            setDeliveryOpId={setDeliveryOpId}
            deliveryOps={deliveryOps}
            factura={factura}
            setFactura={setFactura}
            facturaData={facturaData}
            setFacturaData={setFacturaData}
            onConfirm={confirmDelivery}
            onCreditDelivery={confirmCreditDelivery}
          />
        )}
      </AnimatePresence>

      {/* ── Operator Picker Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {operatorPickEntry && (
          <OperatorPickerModal
            operatorPickEntry={operatorPickEntry}
            onClose={() => setOperatorPickEntry(null)}
            pickedOpId={pickedOpId}
            setPickedOpId={setPickedOpId}
            entryNotes={entryNotes}
            setEntryNotes={setEntryNotes}
            picking={picking}
            activeOperators={activeOperators}
            onConfirm={confirmAdvanceWithOperator}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
