import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth,
  isSameDay, isSameMonth, addMonths, subMonths, parseISO, startOfWeek, endOfWeek, eachDayOfInterval,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, Phone, MessageSquare, CalendarDays as EmptyCalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Modal } from '@/app/components/ui/Modal'
import { Input } from '@/app/components/ui/Input'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { Badge } from '@/app/components/ui/Badge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { VehicleTypeIcon, vehicleTypeLabel } from '@/app/components/ui/VehicleTypeIcon'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { cn } from '@/app/components/ui/cn'
import { mockAppointments, mockAppointmentServices, mockServices } from '@/data/mock'
import type { Appointment, VehicleType } from '@/types'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}
const cardAnim = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

export default function CalendarioCitas() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1)) // March 2026
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 2, 18))
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments)
  const [showModal, setShowModal] = useState(false)
  const [newAppt, setNewAppt] = useState({
    date: format(new Date(2026, 2, 18), 'yyyy-MM-dd'),
    time: '',
    vehicleType: 'automovil' as VehicleType,
    plate: '', brand: '', model: '',
    clientName: '', clientPhone: '', comments: '',
    selectedServices: [] as string[],
  })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

  const dayAppointments = appointments.filter(a =>
    isSameDay(parseISO(a.date), selectedDate)
  )

  const getDotsForDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.date), day))

  function handleAddAppointment() {
    if (!newAppt.clientName) { toast.error('El nombre del cliente es obligatorio'); return }
    const appt: Appointment = {
      id: appointments.length + 1,
      date: newAppt.date, time: newAppt.time || undefined,
      vehicle_type: newAppt.vehicleType,
      plate: newAppt.plate, brand: newAppt.brand, model: newAppt.model,
      client_name: newAppt.clientName, client_phone: newAppt.clientPhone,
      comments: newAppt.comments, status: 'programada',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setAppointments(prev => [...prev, appt].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ))
    toast.success('Cita agendada correctamente', { description: `${newAppt.clientName} · ${format(parseISO(newAppt.date), 'd MMM yyyy', { locale: es })}` })
    setShowModal(false)
    setNewAppt({ date: format(selectedDate, 'yyyy-MM-dd'), time: '', vehicleType: 'automovil', plate: '', brand: '', model: '', clientName: '', clientPhone: '', comments: '', selectedServices: [] })
  }

  function toggleApptService(name: string) {
    setNewAppt(p => ({
      ...p,
      selectedServices: p.selectedServices.includes(name)
        ? p.selectedServices.filter(s => s !== name)
        : [...p.selectedServices, name],
    }))
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Calendario de Citas"
        subtitle={format(currentMonth, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}
        actions={
          <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva Cita
          </Button>
        }
      />

      <div className="grid grid-cols-[380px_1fr] gap-5">
        {/* Calendar */}
        <GlassCard padding={false} className="overflow-hidden">
          {/* Month nav */}
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

          {/* Days header */}
          <div className="grid grid-cols-7 border-b border-white/8">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 p-2 gap-1">
            {calDays.map(day => {
              const isSelected  = isSameDay(day, selectedDate)
              const isToday     = isSameDay(day, new Date(2026, 2, 18))
              const inMonth     = isSameMonth(day, currentMonth)
              const dots        = getDotsForDay(day)

              return (
                <motion.button
                  key={day.toISOString()}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-xl py-1.5 px-1 text-sm transition-colors',
                    isSelected
                      ? 'bg-yellow-500 text-gray-950 font-semibold shadow-lg shadow-yellow-500/30'
                      : isToday
                        ? 'text-yellow-400 font-medium ring-1 ring-yellow-500/40'
                        : inMonth
                          ? 'text-gray-300 hover:bg-white/8'
                          : 'text-gray-700 hover:bg-white/5'
                  )}
                >
                  <span className="leading-none">{format(day, 'd')}</span>
                  {dots.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dots.slice(0, 3).map((_, i) => (
                        <span key={i} className={cn(
                          'w-1 h-1 rounded-full',
                          isSelected ? 'bg-gray-900/60' : 'bg-yellow-500'
                        )} />
                      ))}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </GlassCard>

        {/* Appointments for selected day */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-200">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase())}
            </h2>
            <Badge variant={dayAppointments.length > 0 ? 'yellow' : 'default'}>
              {dayAppointments.length} cita{dayAppointments.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={selectedDate.toISOString()} variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {dayAppointments.length === 0
                ? <EmptyState icon={EmptyCalIcon} title="Sin citas para este día" description="Haz clic en Nueva Cita para agendar" />
                : dayAppointments.map(appt => {
                  const services = mockAppointmentServices.filter(s => s.appointment_id === appt.id)
                  return (
                    <motion.div key={appt.id} variants={cardAnim}>
                      <GlassCard padding hover className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {appt.vehicle_type && (
                              <div className="rounded-xl bg-yellow-500/10 p-2">
                                <VehicleTypeIcon type={appt.vehicle_type} size={20} className="text-yellow-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-white">
                                {appt.brand} {appt.model}
                                {appt.plate && <span className="text-gray-400 text-sm ml-2">{appt.plate}</span>}
                              </div>
                              {appt.vehicle_type && (
                                <div className="text-xs text-gray-500">{vehicleTypeLabel(appt.vehicle_type)}</div>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={appt.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {appt.time && (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <Clock size={13} /> {appt.time}
                            </div>
                          )}
                          {appt.client_name && (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <span className="text-gray-200">{appt.client_name}</span>
                            </div>
                          )}
                          {appt.client_phone && (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <Phone size={13} /> {appt.client_phone}
                            </div>
                          )}
                          {appt.comments && (
                            <div className="flex items-center gap-1.5 text-gray-500 col-span-2">
                              <MessageSquare size={13} /> {appt.comments}
                            </div>
                          )}
                        </div>

                        {services.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {services.map(s => (
                              <Badge key={s.id} variant="yellow">{s.service_name}</Badge>
                            ))}
                          </div>
                        )}
                      </GlassCard>
                    </motion.div>
                  )
                })
              }
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Add Appointment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Cita" size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha *" id="appt-date" type="date" value={newAppt.date}
              onChange={e => setNewAppt(p => ({ ...p, date: e.target.value }))} />
            <Input label="Hora" id="appt-time" type="time" value={newAppt.time}
              onChange={e => setNewAppt(p => ({ ...p, time: e.target.value }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Tipo de Vehículo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['automovil', 'camion_estandar', 'camion_xl'] as VehicleType[]).map(t => (
                <button key={t} onClick={() => setNewAppt(p => ({ ...p, vehicleType: t }))}
                  className={cn('rounded-xl border py-2 px-3 text-sm transition-colors', newAppt.vehicleType === t
                    ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/8')}>
                  {vehicleTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Placa" id="appt-plate" value={newAppt.plate} placeholder="ABC-123"
              onChange={e => setNewAppt(p => ({ ...p, plate: e.target.value.toUpperCase() }))} />
            <Input label="Marca" id="appt-brand" value={newAppt.brand} placeholder="Toyota"
              onChange={e => setNewAppt(p => ({ ...p, brand: e.target.value }))} />
            <Input label="Modelo" id="appt-model" value={newAppt.model} placeholder="Corolla 2020"
              onChange={e => setNewAppt(p => ({ ...p, model: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre Cliente *" id="appt-client" value={newAppt.clientName}
              onChange={e => setNewAppt(p => ({ ...p, clientName: e.target.value }))} />
            <Input label="Teléfono" id="appt-phone" value={newAppt.clientPhone} placeholder="555-1234"
              onChange={e => setNewAppt(p => ({ ...p, clientPhone: e.target.value }))} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Servicios</label>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 max-h-40 overflow-y-auto">
              {mockServices.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1 transition-colors">
                  <input type="checkbox" checked={newAppt.selectedServices.includes(s.name)}
                    onChange={() => toggleApptService(s.name)} className="w-4 h-4 rounded accent-yellow-400" />
                  <span className="text-sm text-gray-300">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Comentarios</label>
            <textarea value={newAppt.comments} rows={2} placeholder="Notas adicionales..."
              onChange={e => setNewAppt(p => ({ ...p, comments: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleAddAppointment}>Guardar Cita</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

