import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, X, Pencil, Check, Car, Users, Package, Wrench,
  AlertCircle, Download, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { cn } from '@/app/components/ui/cn'
import { VehicleTypeIcon, vehicleTypeLabel } from '@/app/components/ui/VehicleTypeIcon'
import { api, type ApiClient, type ApiClientVehicle, type ApiClientCredit } from '@/api'
import type { VehicleType } from '@/types'
import { buildCreditInvoiceHtml } from './clientes/creditInvoiceTemplate'

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-400',
  'bg-purple-500/20 text-purple-400',
  'bg-green-500/20 text-green-400',
  'bg-orange-500/20 text-orange-400',
  'bg-pink-500/20 text-pink-400',
]

function avatarColor(id: number) {
  return AVATAR_COLORS[id % 5]
}

function formatCOP(value: string | number) {
  return Number(value).toLocaleString('es-CO')
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CREDIT_METHODS = [
  { key: 'cash',        label: 'Efectivo' },
  { key: 'datafono',    label: 'Banco Caja Social' },
  { key: 'nequi',       label: 'Nequi' },
  { key: 'bancolombia', label: 'Bancolombia Ahorros' },
]

// ── skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-white/8 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 rounded bg-white/8" />
        <div className="h-3 w-24 rounded bg-white/6" />
      </div>
      <div className="hidden sm:flex gap-2">
        <div className="h-5 w-20 rounded-full bg-white/8" />
        <div className="h-5 w-20 rounded-full bg-white/8" />
      </div>
      <div className="w-5 h-5 rounded bg-white/6" />
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiProps { label: string; value: number | string; icon: React.ReactNode; color: string; onClick?: () => void; active?: boolean }

function KpiCard({ label, value, icon, color, onClick, active }: KpiProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'rounded-2xl border p-4 flex items-center gap-4 transition-all duration-200',
        active
          ? 'border-red-500/50 bg-red-500/10 ring-1 ring-red-500/30'
          : 'border-white/8 bg-white/[0.03]',
        onClick && 'hover:border-white/16 hover:bg-white/[0.06] cursor-pointer w-full text-left',
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-white mt-0.5">{value}</p>
      </div>
      {active && <span className="ml-auto text-xs text-red-400 font-medium shrink-0">Filtrado</span>}
    </Tag>
  )
}

// ── client row ────────────────────────────────────────────────────────────────

interface ClientRowProps {
  client: ApiClient
  onClick: () => void
}

function ClientRow({ client, onClick }: ClientRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/12 transition-all duration-200 p-4 flex items-center gap-4 group"
    >
      {/* Avatar */}
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0', avatarColor(client.id))}>
        {initials(client.name)}
      </div>

      {/* Name + phone + FE */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white break-all">{client.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{client.phone ?? '—'}</p>
        {client.identificacion && (
          <p className="text-xs text-blue-400 font-mono mt-0.5">
            {client.tipo_identificacion === 'NIT' ? 'NIT' : 'ID'} {client.identificacion}{client.dv ? `-${client.dv}` : ''}
          </p>
        )}
        {Number(client.pending_credit_total) > 0 && (
          <p className="text-xs text-red-400 font-medium mt-0.5 flex items-center gap-1">
            <AlertCircle size={10} />
            Debe ${formatCOP(client.pending_credit_total)}
          </p>
        )}
      </div>

      {/* Chips */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1 text-xs bg-white/6 border border-white/8 rounded-full px-2.5 py-1 text-gray-300">
          <Car size={11} className="text-gray-400" />
          {client.vehicles.length} vehículo{client.vehicles.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1 text-xs bg-white/6 border border-white/8 rounded-full px-2.5 py-1 text-gray-300">
          <Package size={11} className="text-gray-400" />
          {client.order_count} servicio{client.order_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Last service + spent */}
      <div className="hidden md:flex flex-col items-end shrink-0 gap-0.5">
        <p className="text-xs text-gray-400">{formatDate(client.last_service)}</p>
        <p className="text-sm font-semibold text-yellow-400">${formatCOP(client.total_spent)}</p>
      </div>

      <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
    </button>
  )
}

// ── drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  client: ApiClient
  onClose: () => void
  onUpdated: (c: ApiClient) => void
}

function ClientDrawer({ client, onClose, onUpdated }: DrawerProps) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name:                client.name,
    phone:               client.phone               ?? '',
    email:               client.email               ?? '',
    tipo_persona:        client.tipo_persona        ?? 'natural',
    tipo_identificacion: client.tipo_identificacion ?? '',
    identificacion:      client.identificacion      ?? '',
    dv:                  client.dv                  ?? '',
    notes:               client.notes               ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Credit debt state
  const [credits, setCredits]               = useState<ApiClientCredit[]>([])
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [payModal, setPayModal]             = useState(false)
  const [payMethods, setPayMethods]         = useState<Record<string, string>>({})
  const [paying, setPaying]                 = useState(false)

  // Reset form when client changes
  useEffect(() => {
    setEditing(false)
    setEditForm({
      name:                client.name,
      phone:               client.phone               ?? '',
      email:               client.email               ?? '',
      tipo_persona:        client.tipo_persona        ?? 'natural',
      tipo_identificacion: client.tipo_identificacion ?? '',
      identificacion:      client.identificacion      ?? '',
      dv:                  client.dv                  ?? '',
      notes:               client.notes               ?? '',
    })
  }, [client.id])

  // Fetch credits when client has pending debt
  useEffect(() => {
    setCredits([])
    if (Number(client.pending_credit_total) <= 0) return
    setCreditsLoading(true)
    api.clients.getCredits(client.id)
      .then(setCredits)
      .catch(() => toast.error('Error al cargar deudas'))
      .finally(() => setCreditsLoading(false))
  }, [client.id, client.pending_credit_total])

  function togglePayMethod(key: string) {
    setPayMethods(prev => {
      const next = { ...prev }
      if (key in next) delete next[key]
      else next[key] = ''
      return next
    })
  }

  const totalDebt   = credits.reduce((s, c) => s + Number(c.amount), 0)
  const checkedKeys = Object.keys(payMethods)
  const isMulti     = checkedKeys.length > 1
  const coveredAmt  = isMulti
    ? checkedKeys.reduce((s, k) => s + (Number(payMethods[k]) || 0), 0)
    : totalDebt
  const diffAmt     = totalDebt - coveredAmt

  async function handlePayCredits() {
    const keyToField: Record<string, 'payment_cash' | 'payment_datafono' | 'payment_nequi' | 'payment_bancolombia'> = {
      cash: 'payment_cash', datafono: 'payment_datafono',
      nequi: 'payment_nequi', bancolombia: 'payment_bancolombia',
    }
    const payload = { payment_cash: 0, payment_datafono: 0, payment_nequi: 0, payment_bancolombia: 0 }
    if (checkedKeys.length === 1) {
      payload[keyToField[checkedKeys[0]]] = totalDebt
    } else {
      for (const k of checkedKeys) payload[keyToField[k]] = Number(payMethods[k]) || 0
    }
    setPaying(true)
    try {
      await api.clients.payCredits(client.id, payload)
      toast.success('Pago registrado')
      setPayModal(false)
      setPayMethods({})
      setCredits([])
      const updated = await api.clients.patch(client.id, {})
      onUpdated({ ...client, ...updated })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar pago')
    } finally {
      setPaying(false)
    }
  }

  function handleDownloadInvoice() {
    if (credits.length === 0) return
    const now = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = buildCreditInvoiceHtml(client, credits, now)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (win) win.focus()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  async function handleSave() {
    if (!editForm.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      const updated = await api.clients.patch(client.id, {
        name:                editForm.name.trim()                || undefined,
        phone:               editForm.phone.trim()               || undefined,
        email:               editForm.email.trim()               || undefined,
        tipo_persona:        editForm.tipo_persona               || undefined,
        tipo_identificacion: editForm.tipo_identificacion.trim() || undefined,
        identificacion:      editForm.identificacion.trim()      || undefined,
        dv:                  editForm.dv.trim()                  || undefined,
        notes:               editForm.notes.trim()               || undefined,
      })
      onUpdated(updated)
      setEditing(false)
      toast.success('Cliente actualizado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const clientYear = new Date(client.created_at).getFullYear()

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 z-50 max-w-md w-full bg-gray-900 border-l border-white/8 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 p-5 border-b border-white/8 flex items-start gap-4">
          <div className={cn('w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0', avatarColor(client.id))}>
            {initials(client.name)}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                className={inputClass}
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre del cliente"
              />
            ) : (
              <h2 className="text-base font-semibold text-white leading-tight break-all">{client.name}</h2>
            )}
            <p className="text-xs text-gray-500 mt-1">Cliente desde {clientYear}</p>
          </div>

          {/* Edit / Save / Cancel buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEditing(false); setEditForm({ name: client.name, phone: client.phone ?? '', email: client.email ?? '', tipo_persona: client.tipo_persona ?? 'natural', tipo_identificacion: client.tipo_identificacion ?? '', identificacion: client.identificacion ?? '', dv: client.dv ?? '', notes: client.notes ?? '' }) }}
                  disabled={saving}
                >
                  <X size={14} />
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Check size={14} className="mr-1" />
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                title="Editar cliente"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Contact fields in edit mode */}
          {editing && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Información de contacto</p>
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Teléfono</label>
                <input
                  className={inputClass}
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Número de teléfono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Correo electrónico</label>
                <input
                  className={inputClass}
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Notas</label>
                <textarea
                  className={cn(inputClass, 'resize-none')}
                  rows={3}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas adicionales…"
                />
              </div>
              {/* Invoice fields */}
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider pt-1">Datos de facturación electrónica</p>
              {/* Tipo de persona toggle */}
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                {(['natural', 'empresa'] as const).map(tp => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, tipo_persona: tp, tipo_identificacion: '', dv: '' }))}
                    className={cn(
                      'flex-1 py-2 text-xs font-medium transition-colors',
                      editForm.tipo_persona === tp
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]',
                    )}
                  >
                    {tp === 'natural' ? 'Persona Natural' : 'Empresa'}
                  </button>
                ))}
              </div>
              {/* Tipo de identificación */}
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Tipo de identificación</label>
                <div className="relative">
                  <select
                    className={cn(inputClass, 'appearance-none pr-8 cursor-pointer')}
                    value={editForm.tipo_identificacion}
                    onChange={e => setEditForm(f => ({ ...f, tipo_identificacion: e.target.value, dv: '' }))}
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">— Seleccionar —</option>
                    {editForm.tipo_persona === 'natural' ? (
                      <>
                        <option value="Cédula de Ciudadanía">Cédula de Ciudadanía</option>
                        <option value="Cédula de Extranjería">Cédula de Extranjería</option>
                        <option value="Pasaporte">Pasaporte</option>
                        <option value="Tarjeta de Identidad">Tarjeta de Identidad</option>
                      </>
                    ) : (
                      <>
                        <option value="NIT">NIT</option>
                        <option value="NIT Extranjero">NIT Extranjero</option>
                      </>
                    )}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              {/* Número de identificación + DV */}
              <div className={cn('gap-2', editForm.tipo_identificacion === 'NIT' ? 'grid grid-cols-3' : 'block space-y-0')}>
                <div className={cn('space-y-2', editForm.tipo_identificacion === 'NIT' ? 'col-span-2' : '')}>
                  <label className="block text-xs text-gray-400">Número de identificación</label>
                  <input
                    className={inputClass}
                    value={editForm.identificacion}
                    onChange={e => setEditForm(f => ({ ...f, identificacion: e.target.value }))}
                    placeholder="Ej: 900123456"
                  />
                </div>
                {editForm.tipo_identificacion === 'NIT' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400">DV</label>
                    <input
                      className={inputClass}
                      value={editForm.dv}
                      onChange={e => setEditForm(f => ({ ...f, dv: e.target.value.slice(0, 1) }))}
                      placeholder="7"
                      maxLength={1}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact info display (not editing) */}
          {!editing && (client.phone || client.email || client.notes) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Contacto</p>
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16 text-xs">Teléfono</span>
                  <span className="text-gray-200">{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16 text-xs">Email</span>
                  <span className="text-gray-200 truncate">{client.email}</span>
                </div>
              )}
              {client.notes && (
                <div className="rounded-xl bg-white/[0.03] border border-white/8 px-3 py-2 text-xs text-gray-400 italic">
                  {client.notes}
                </div>
              )}
            </div>
          )}

          {/* Invoice data display (not editing) */}
          {!editing && (client.tipo_persona || client.identificacion) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Facturación electrónica</p>
              {client.tipo_persona && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-24 text-xs shrink-0">Persona</span>
                  <span className="text-gray-200 capitalize">{client.tipo_persona === 'natural' ? 'Natural' : 'Empresa'}</span>
                </div>
              )}
              {client.tipo_identificacion && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-24 text-xs shrink-0">Tipo ID</span>
                  <span className="text-gray-200">{client.tipo_identificacion}</span>
                </div>
              )}
              {client.identificacion && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-24 text-xs shrink-0">
                    {client.tipo_identificacion === 'NIT' ? 'NIT' : 'Identificación'}
                  </span>
                  <span className="text-gray-200 font-mono">
                    {client.identificacion}{client.dv ? `-${client.dv}` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Estadísticas */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Estadísticas</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
                <p className="text-lg font-semibold text-white">{client.order_count}</p>
                <p className="text-xs text-gray-500 mt-0.5">Servicios</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
                <p className="text-sm font-medium text-white leading-tight">{formatDate(client.last_service)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Último serv.</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
                <p className="text-sm font-semibold text-yellow-400 leading-tight">${formatCOP(client.total_spent)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total gastado</p>
              </div>
            </div>
          </div>

          {/* Vehículos */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Vehículos ({client.vehicles.length})
            </p>
            {client.vehicles.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Sin vehículos registrados</p>
            ) : (
              <div className="space-y-2">
                {client.vehicles.map((v: ApiClientVehicle) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/8 px-3 py-2.5"
                  >
                    <VehicleTypeIcon
                      type={v.type as VehicleType}
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{v.plate}</span>
                        {v.brand && (
                          <span className="text-xs text-gray-400 truncate">
                            {v.brand}{v.model ? ` ${v.model}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{vehicleTypeLabel(v.type as VehicleType)}</p>
                    </div>
                    {v.color && (
                      <span className="text-xs bg-white/8 border border-white/10 rounded-full px-2 py-0.5 text-gray-300 shrink-0">
                        {v.color}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deudas pendientes */}
          {(creditsLoading || credits.length > 0 || Number(client.pending_credit_total) > 0) && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={12} />
                Deudas pendientes
              </p>

              {creditsLoading ? (
                <div className="text-xs text-gray-500 animate-pulse">Cargando deudas...</div>
              ) : credits.length === 0 ? (
                <div className="text-xs text-gray-500 italic">Sin deudas pendientes</div>
              ) : (
                <>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-red-500/10">
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Orden</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Entrega</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Placa</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credits.map(c => (
                          <tr key={c.order_id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 text-gray-300 font-mono">{c.order_number}</td>
                            <td className="px-3 py-2 text-gray-400">{formatDate(c.delivered_at)}</td>
                            <td className="px-3 py-2 text-gray-400 font-semibold">{c.plate}</td>
                            <td className="px-3 py-2 text-red-400 text-right font-semibold">${formatCOP(c.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-red-500/20 bg-red-500/5">
                          <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-300">Total</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-red-400">${formatCOP(totalDebt)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 flex items-center justify-center gap-1.5"
                      onClick={handleDownloadInvoice}
                    >
                      <Download size={13} />
                      Descargar factura
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 bg-red-600/80 hover:bg-red-600 border-red-500/40"
                      onClick={() => { setPayModal(true); setPayMethods({}) }}
                    >
                      Registrar pago
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Credit payment modal */}
      <AnimatePresence>
        {payModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) { setPayModal(false); setPayMethods({}) } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5"
            >
              <div>
                <h3 className="text-base font-semibold text-white">Registrar pago</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {client.name} · Total: <span className="text-red-400 font-semibold">${formatCOP(totalDebt)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Método de pago</p>
                <div className="space-y-1.5">
                  {CREDIT_METHODS.map(m => {
                    const isChecked = m.key in payMethods
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => togglePayMethod(m.key)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          isChecked
                            ? 'border-yellow-500/60 bg-yellow-500/10'
                            : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                          isChecked ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600'
                        )}>
                          {isChecked && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-gray-900" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4l2.5 2.5L9 1" />
                            </svg>
                          )}
                        </div>
                        <p className={cn('text-sm font-medium flex-1', isChecked ? 'text-yellow-300' : 'text-gray-300')}>
                          {m.label}
                        </p>
                        {isChecked && isMulti && (
                          <input
                            type="text" inputMode="numeric" placeholder="0"
                            value={Number(payMethods[m.key] || '0').toLocaleString('es-CO')}
                            onChange={e => {
                              e.stopPropagation()
                              const raw = e.target.value.replace(/\./g, '').replace(/,/g, '')
                              setPayMethods(prev => ({ ...prev, [m.key]: raw }))
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-right text-gray-100 focus:border-yellow-500/50 focus:outline-none"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {isMulti && (
                <div className={cn(
                  'text-xs text-center rounded-xl px-3 py-2 font-medium',
                  diffAmt === 0 ? 'text-green-400 bg-green-500/10 border border-green-500/20' :
                  diffAmt <  0 ? 'text-blue-400  bg-blue-500/10  border border-blue-500/20'  :
                                 'text-orange-400 bg-orange-500/10 border border-orange-500/20'
                )}>
                  {diffAmt === 0 && '✓ Pago completo'}
                  {diffAmt <  0 && `Cambio al cliente: $${formatCOP(Math.abs(diffAmt))}`}
                  {diffAmt >  0 && `Pendiente: $${formatCOP(diffAmt)}`}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => setPayModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={handlePayCredits}
                  disabled={paying || checkedKeys.length === 0 || (isMulti && diffAmt !== 0)}
                >
                  {paying ? 'Guardando...' : 'Confirmar pago'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Clientes() {
  const [clients, setClients] = useState<ApiClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterDebt, setFilterDebt] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ApiClient | null>(null)

  // Fetch clients (debounced server-side search)
  const fetchClients = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const data = await api.clients.list(q || undefined)
      setClients(data)
    } catch {
      toast.error('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => fetchClients(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search, fetchClients])

  // KPI calculations
  const totalVehicles = useMemo(
    () => clients.reduce((acc, c) => acc + c.vehicles.length, 0),
    [clients],
  )
  const totalServices = useMemo(
    () => clients.reduce((acc, c) => acc + c.order_count, 0),
    [clients],
  )
  const totalWithDebt = useMemo(
    () => clients.filter(c => Number(c.pending_credit_total) > 0).length,
    [clients],
  )

  // Client-side filter for instant feedback while debounce is pending
  const filtered = useMemo(() => {
    let result = clients
    if (filterDebt) result = result.filter(c => Number(c.pending_credit_total) > 0)
    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result.filter(
      c => c.name.toLowerCase().includes(q) ||
           (c.phone ?? '').includes(q) ||
           c.vehicles.some(v => v.plate.toLowerCase().includes(q)),
    )
  }, [clients, search, filterDebt])

  function handleUpdated(updated: ApiClient) {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c))
    setSelectedClient(updated)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} cliente${clients.length !== 1 ? 's' : ''} registrado${clients.length !== 1 ? 's' : ''}`}
        actions={
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o placa…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
            />
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Clientes"
          value={clients.length}
          icon={<Users size={18} />}
          color="bg-blue-500/15 text-blue-400"
        />
        <KpiCard
          label="Vehículos Registrados"
          value={totalVehicles}
          icon={<Car size={18} />}
          color="bg-purple-500/15 text-purple-400"
        />
        <KpiCard
          label="Servicios Totales"
          value={totalServices}
          icon={<Wrench size={18} />}
          color="bg-yellow-500/15 text-yellow-400"
        />
        <KpiCard
          label="Con Deuda"
          value={totalWithDebt}
          icon={<CreditCard size={18} />}
          color="bg-red-500/15 text-red-400"
          onClick={() => setFilterDebt(f => !f)}
          active={filterDebt}
        />
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] py-16 flex flex-col items-center gap-3 text-gray-500">
            <Users size={36} className="text-gray-700" />
            <p className="text-sm">{search ? 'Sin resultados para esa búsqueda' : 'No hay clientes registrados'}</p>
          </div>
        ) : (
          filtered.map(c => (
            <ClientRow
              key={c.id}
              client={c}
              onClick={() => setSelectedClient(c)}
            />
          ))
        )}
      </div>

      {/* Right drawer */}
      <AnimatePresence>
        {selectedClient && (
          <ClientDrawer
            key={selectedClient.id}
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onUpdated={handleUpdated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
