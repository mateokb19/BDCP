import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth,
  isSameDay, isSameMonth, addMonths, subMonths, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isBefore, startOfDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, Phone, MessageSquare, CalendarDays as EmptyCalIcon, Pencil, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Modal } from '@/app/components/ui/Modal'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { VehicleTypeIcon, vehicleTypeLabel } from '@/app/components/ui/VehicleTypeIcon'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { useNavigate } from 'react-router'
import { api, type ApiAppointment } from '@/api'
import type { VehicleType } from '@/types'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const BRANDS = [
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Mazda', 'Volkswagen',
  'Hyundai', 'Kia', 'Renault', 'Peugeot', 'Suzuki', 'Jeep', 'RAM',
  'BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'Porsche', 'Land Rover',
  'Subaru', 'Mitsubishi', 'Fiat', 'BYD', 'Chery', 'JAC',
]

const MODELS_BY_BRAND: Record<string, string[]> = {
  Toyota:          ['Corolla', 'Hilux', 'Camry', 'RAV4', 'Fortuner', 'Land Cruiser', 'Yaris', 'Rush', 'SW4'],
  Honda:           ['Civic', 'CR-V', 'Fit', 'HR-V', 'Accord', 'Pilot', 'WR-V'],
  Ford:            ['F-150', 'Ranger', 'Explorer', 'Escape', 'Bronco', 'Mustang', 'Territory', 'Edge'],
  Chevrolet:       ['Silverado', 'Colorado', 'Tahoe', 'Equinox', 'Traverse', 'Spark', 'Trax', 'Blazer', 'Captiva'],
  Nissan:          ['Sentra', 'Frontier', 'X-Trail', 'Versa', 'Kicks', 'Pathfinder', 'Murano', 'NP300'],
  Mazda:           ['CX-5', 'Mazda3', 'CX-9', 'CX-3', 'CX-30', 'BT-50', 'MX-5'],
  Volkswagen:      ['Jetta', 'Golf', 'Tiguan', 'Polo', 'Passat', 'Amarok', 'T-Cross', 'Taos'],
  Hyundai:         ['Tucson', 'Santa Fe', 'Elantra', 'Creta', 'Accent', 'Ioniq', 'Palisade', 'Venue'],
  Kia:             ['Sportage', 'Sorento', 'Picanto', 'Seltos', 'Rio', 'Telluride', 'Stinger', 'Soul'],
  Renault:         ['Sandero', 'Logan', 'Duster', 'Captur', 'Koleos', 'Kwid', 'Symbol', 'Stepway', 'Oroch'],
  Peugeot:         ['208', '301', '308', '2008', '3008', '508', '5008'],
  Suzuki:          ['Swift', 'Vitara', 'Grand Vitara', 'Baleno', 'Jimny', 'S-Cross', 'Ertiga'],
  Jeep:            ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Compass', 'Renegade', 'Gladiator'],
  RAM:             ['700', '1500', '2500', 'ProMaster'],
  BMW:             ['3 Series', '5 Series', 'X3', 'X5', 'X1', 'X7', '7 Series', 'M3', 'M5'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLA', 'GLC', 'GLE', 'A-Class', 'S-Class', 'CLA'],
  Audi:            ['A4', 'Q5', 'A3', 'Q3', 'A6', 'Q7', 'Q8', 'e-tron'],
  Volvo:           ['XC40', 'XC60', 'XC90', 'S60', 'V60', 'C40'],
  Porsche:         ['Cayenne', 'Macan', '911', 'Panamera', 'Taycan', 'Cayenne E-Hybrid'],
  'Land Rover':    ['Discovery', 'Defender', 'Range Rover', 'Freelander', 'Evoque', 'Velar'],
  Subaru:          ['Impreza', 'Forester', 'Outback', 'XV', 'Legacy', 'WRX'],
  Mitsubishi:      ['Outlander', 'Montero', 'L200', 'Eclipse Cross', 'Lancer', 'ASX'],
  Fiat:            ['Argo', 'Pulse', 'Toro', 'Strada', 'Mobi', 'Cronos'],
  BYD:             ['Han', 'Tang', 'Atto 3', 'Dolphin', 'Song Plus', 'Seal'],
  Chery:           ['Tiggo 2', 'Tiggo 4', 'Tiggo 7', 'Arrizo 5', 'Tiggo 8'],
  JAC:             ['S3', 'S5', 'T6', 'T8', 'JS4', 'Sei 2'],
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completada:  { label: 'Completada',  color: 'bg-green-500/15 text-green-400' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-500/15 text-red-400' },
  no_asistio:  { label: 'No asistió',  color: 'bg-gray-500/15 text-gray-400' },
}

const emptyForm = {
  date: '',
  time: '',
  vehicleType: 'automovil' as VehicleType,
  plate: '',
  brand: '',
  model: '',
  clientName: '',
  clientPhone: '',
  comments: '',
  status: 'programada',
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

const selectCls = 'w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none disabled:opacity-40'

export default function CalendarioCitas() {
  const navigate = useNavigate()
  const today = new Date()
  const TODAY_STR = format(today, 'yyyy-MM-dd')
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editAppt, setEditAppt] = useState<ApiAppointment | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [confirmAppt, setConfirmAppt] = useState<ApiAppointment | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 0 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

  // Fetch appointments whenever month changes
  useEffect(() => {
    const month = format(currentMonth, 'yyyy-MM')
    setLoading(true)
    api.appointments.list(month)
      .then(setAppointments)
      .catch(() => toast.error('Error al cargar citas'))
      .finally(() => setLoading(false))
  }, [currentMonth])

  const dayAppointments = appointments
    .filter(a => isSameDay(parseISO(a.date), selectedDate))
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))

  const getDotsForDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.date), day))

  function openCreate() {
    setEditAppt(null)
    setForm({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') })
    setShowModal(true)
  }

  function openEdit(appt: ApiAppointment) {
    setEditAppt(appt)
    setForm({
      date:        appt.date,
      time:        appt.time        ?? '',
      vehicleType: (appt.vehicle_type as VehicleType) ?? 'automovil',
      plate:       appt.plate       ?? '',
      brand:       appt.brand       ?? '',
      model:       appt.model       ?? '',
      clientName:  appt.client_name  ?? '',
      clientPhone: appt.client_phone ?? '',
      comments:    appt.comments    ?? '',
      status:      appt.status,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.clientName.trim()) { toast.error('El nombre del cliente es obligatorio'); return }
    if (!form.date)              { toast.error('La fecha es obligatoria'); return }
    setSaving(true)
    const payload = {
      date:         form.date,
      time:         form.time        || undefined,
      vehicle_type: form.vehicleType || undefined,
      plate:        form.plate.trim().toUpperCase() || undefined,
      brand:        form.brand       || undefined,
      model:        form.model       || undefined,
      client_name:  form.clientName.trim(),
      client_phone: form.clientPhone || undefined,
      comments:     form.comments    || undefined,
    }
    try {
      if (editAppt) {
        const updated = await api.appointments.patch(editAppt.id, { ...payload, status: form.status })
        setAppointments(prev =>
          prev.map(a => a.id === editAppt.id ? updated : a)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
        )
        toast.success('Cita actualizada')
      } else {
        const created = await api.appointments.create(payload)
        setAppointments(prev => [...prev, created].sort((a, b) =>
          a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')
        ))
        toast.success('Cita agendada', { description: `${form.clientName} · ${format(parseISO(form.date), "d 'de' MMMM", { locale: es })}` })
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar cita')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(appt: ApiAppointment) {
    try {
      await api.appointments.delete(appt.id)
      setAppointments(prev => prev.filter(a => a.id !== appt.id))
      toast.success('Cita eliminada')
    } catch {
      toast.error('Error al eliminar la cita')
    }
  }

  function handleAddService(appt: ApiAppointment) {
    if (appt.date === TODAY_STR) {
      navigate('/', { state: { fromAppointment: appt } })
    } else {
      setConfirmAppt(appt)
    }
  }

  const availableModels = MODELS_BY_BRAND[form.brand] ?? []

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Calendario de Citas"
        subtitle={format(currentMonth, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}
        actions={
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus size={16} /> Nueva Cita
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-5">
        {/* Calendar */}
        <GlassCard padding={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-200">
              {format(currentMonth, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}
            </span>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-white/8">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 p-2 gap-1">
            {calDays.map(day => {
              const isSelected = isSameDay(day, selectedDate)
              const isToday    = isSameDay(day, today)
              const inMonth    = isSameMonth(day, currentMonth)
              const isPast     = isBefore(startOfDay(day), startOfDay(today)) && !isToday
              const dots       = getDotsForDay(day)
              return (
                <motion.button
                  key={day.toISOString()}
                  whileHover={{ scale: isPast ? 1 : 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-xl py-2 px-1 text-sm transition-colors',
                    isSelected
                      ? 'bg-yellow-500 text-gray-950 font-bold shadow-lg shadow-yellow-500/25'
                      : isToday
                        ? 'text-yellow-400 font-semibold ring-1 ring-yellow-500/50 bg-yellow-500/5'
                        : isPast
                          ? inMonth ? 'text-gray-700 cursor-default' : 'text-gray-800 cursor-default'
                          : inMonth
                            ? 'text-gray-300 hover:bg-white/8 hover:text-white'
                            : 'text-gray-600 hover:bg-white/5'
                  )}
                >
                  <span className="leading-none">{format(day, 'd')}</span>
                  {dots.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dots.slice(0, 3).map((_, i) => (
                        <span key={i} className={cn(
                          'w-1 h-1 rounded-full',
                          isSelected ? 'bg-gray-900/70' : isPast ? 'bg-gray-600' : 'bg-yellow-500'
                        )} />
                      ))}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </GlassCard>

        {/* Appointments panel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-200">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
            </h2>
            <Badge variant={dayAppointments.length > 0 ? 'yellow' : 'default'}>
              {dayAppointments.length} cita{dayAppointments.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-500 text-sm">Cargando citas...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={selectedDate.toISOString()} variants={stagger} initial="hidden" animate="show" className="space-y-3">
                {dayAppointments.length === 0
                  ? <EmptyState icon={EmptyCalIcon} title="Sin citas para este día" description="Haz clic en Nueva Cita para agendar" />
                  : dayAppointments.map(appt => {
                    const statusInfo = STATUS_LABELS[appt.status]
                    return (
                      <motion.div key={appt.id} variants={cardAnim}>
                        <GlassCard padding hover className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              {appt.vehicle_type && (
                                <div className="rounded-xl bg-yellow-500/10 p-2 shrink-0">
                                  <VehicleTypeIcon type={appt.vehicle_type as VehicleType} size={20} className="text-yellow-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-white truncate">
                                  {appt.brand} {appt.model}
                                  {appt.plate && <span className="text-gray-400 text-sm ml-2">{appt.plate}</span>}
                                </div>
                                {appt.vehicle_type && (
                                  <div className="text-xs text-gray-500">{vehicleTypeLabel(appt.vehicle_type as VehicleType)}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {statusInfo && (
                                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', statusInfo.color)}>
                                  {statusInfo.label}
                                </span>
                              )}
                              {(appt.status === 'programada' || appt.status === 'confirmada') && (
                                <button
                                  onClick={() => handleAddService(appt)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                                  title="Agregar servicio"
                                >
                                  <Wrench size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => openEdit(appt)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                                title="Editar cita"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(appt)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Eliminar cita"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 text-sm">
                            {appt.time && (
                              <div className="flex items-center gap-1.5 text-gray-400">
                                <Clock size={13} /> {appt.time}
                              </div>
                            )}
                            {appt.client_name && (
                              <div className="text-gray-200">{appt.client_name}</div>
                            )}
                            {appt.client_phone && (
                              <div className="flex items-center gap-1.5 text-gray-400">
                                <Phone size={13} /> {appt.client_phone}
                              </div>
                            )}
                            {appt.comments && (
                              <div className="flex items-center gap-1.5 text-gray-500">
                                <MessageSquare size={13} className="shrink-0" />
                                <span className="truncate">{appt.comments}</span>
                              </div>
                            )}
                          </div>
                        </GlassCard>
                      </motion.div>
                    )
                  })
                }
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Confirm add-service on future date */}
      <Modal open={confirmAppt !== null} onClose={() => setConfirmAppt(null)} title="¿Agregar servicio?" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-gray-300 text-sm leading-relaxed">
            Esta cita está programada para el{' '}
            <span className="text-white font-medium">
              {confirmAppt && format(parseISO(confirmAppt.date), "d 'de' MMMM", { locale: es })}
            </span>
            , que no es hoy. ¿Deseas agregar el servicio de todos modos?
          </p>
          {confirmAppt?.client_name && (
            <p className="text-xs text-gray-500">
              {confirmAppt.client_name}{confirmAppt.plate ? ` · ${confirmAppt.plate}` : ''}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setConfirmAppt(null)}>
              No, volver
            </Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => {
              if (confirmAppt) {
                navigate('/', { state: { fromAppointment: confirmAppt } })
                setConfirmAppt(null)
              }
            }}>
              Sí, agregar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editAppt ? 'Editar Cita' : 'Nueva Cita'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Fecha *</label>
              <input type="date" value={form.date}
                min={editAppt ? undefined : format(today, 'yyyy-MM-dd')}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className={cn(selectCls, '[color-scheme:dark]')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">
              Hora
              {form.time && (
                <span className="ml-2 text-yellow-400 font-semibold">{form.time}</span>
              )}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 19 }, (_, i) => {
                const totalMinutes = 8 * 60 + i * 30
                const h = Math.floor(totalMinutes / 60)
                const m = totalMinutes % 60
                const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                const label = `${h}:${m === 0 ? '00' : '30'}`
                const selected = form.time === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, time: selected ? '' : val }))}
                    className={cn(
                      'rounded-lg py-1.5 text-sm font-medium transition-colors border',
                      selected
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        : 'bg-white/5 border-white/8 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Tipo de Vehículo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['automovil', 'camion_estandar', 'camion_xl'] as VehicleType[]).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, vehicleType: t }))}
                  className={cn('rounded-xl border py-2 px-3 text-sm transition-colors', form.vehicleType === t
                    ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/8')}>
                  {vehicleTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Marca</label>
              <select value={form.brand}
                onChange={e => setForm(p => ({ ...p, brand: e.target.value, model: '' }))}
                className={selectCls}>
                <option value="">— Seleccionar —</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Modelo</label>
              <select value={form.model}
                onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
                disabled={!form.brand}
                className={selectCls}>
                <option value="">— Seleccionar —</option>
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Placa</label>
              <input value={form.plate} placeholder="ABC123"
                onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))}
                className={selectCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Nombre Cliente *</label>
              <input value={form.clientName} placeholder="Nombre completo"
                onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                className={selectCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Teléfono</label>
              <input value={form.clientPhone} placeholder="3001234567"
                onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value.replace(/[^0-9+]/g, '') }))}
                className={selectCls} />
            </div>
          </div>

          {/* Status selector — only shown in edit mode */}
          {editAppt && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Estado</label>
              <select value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className={selectCls}>
                <option value="programada">Programada</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
                <option value="no_asistio">No asistió</option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Comentarios</label>
            <textarea value={form.comments} rows={2} placeholder="Notas adicionales..."
              onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editAppt ? 'Guardar cambios' : 'Agendar Cita'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
