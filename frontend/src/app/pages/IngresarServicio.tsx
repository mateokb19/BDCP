import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Car, Truck, Check, ChevronRight, Search, User, Phone, Palette, Hash, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { Badge } from '@/app/components/ui/Badge'
import { cn } from '@/app/components/ui/cn'
import { api } from '@/api'
import { Select } from '@/app/components/ui/Select'
import { useAppContext } from '@/app/context/AppContext'
import type { VehicleType, Service } from '@/types'

type Step = 1 | 2 | 3

interface OrderDraft {
  plate: string
  brand: string
  model: string
  color: string
  clientName: string
  clientPhone: string
  operatorId: number | null
  selectedServices: number[]
  notes: string
}

const TODAY = new Date().toISOString().split('T')[0]

const vehicleOptions: { type: VehicleType; label: string; sub: string; icon: React.ReactNode }[] = [
  { type: 'automovil',       label: 'Automóvil',          sub: 'Sedán, SUV, Hatchback',      icon: <Car size={48} /> },
  { type: 'camion_estandar', label: 'Camioneta Estándar', sub: 'Pick-up, Van mediana',        icon: <Truck size={48} /> },
  { type: 'camion_xl',       label: 'Camioneta XL',       sub: 'Camión grande, Doble cabina', icon: <Truck size={52} /> },
]

const categoryColors: Record<string, string> = {
  exterior: 'bg-yellow-500/10 border-yellow-500/20',
  interior: 'bg-blue-500/10 border-blue-500/20',
  ceramico: 'bg-purple-500/10 border-purple-500/20',
}
const categoryLabels: Record<string, string> = {
  exterior: 'Exterior',
  interior: 'Interior',
  ceramico: 'Cerámico',
}

const BRANDS = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Mazda', 'Volkswagen', 'Hyundai', 'Kia', 'BMW', 'Mercedes-Benz', 'Audi', 'Subaru', 'Mitsubishi']

const MODELS_BY_BRAND: Record<string, string[]> = {
  Toyota:         ['Corolla', 'Hilux', 'Camry', 'RAV4', 'Fortuner', 'Land Cruiser', 'Yaris'],
  Honda:          ['Civic', 'CR-V', 'Fit', 'HR-V', 'Accord', 'Pilot'],
  Ford:           ['F-150', 'Ranger', 'Explorer', 'Escape', 'Bronco', 'Mustang'],
  Chevrolet:      ['Silverado', 'Colorado', 'Tahoe', 'Equinox', 'Traverse', 'Spark'],
  Nissan:         ['Sentra', 'Frontier', 'X-Trail', 'Versa', 'Kicks', 'Pathfinder'],
  Mazda:          ['CX-5', 'Mazda3', 'CX-9', 'CX-3', 'BT-50', 'MX-5'],
  Volkswagen:     ['Jetta', 'Golf', 'Tiguan', 'Polo', 'Passat', 'Amarok'],
  Hyundai:        ['Tucson', 'Santa Fe', 'Elantra', 'Creta', 'Accent', 'Ioniq'],
  Kia:            ['Sportage', 'Sorento', 'Picanto', 'Seltos', 'Rio', 'Telluride'],
  BMW:            ['3 Series', '5 Series', 'X3', 'X5', 'X1', '7 Series'],
  'Mercedes-Benz':['C-Class', 'E-Class', 'GLA', 'GLC', 'A-Class', 'S-Class'],
  Audi:           ['A4', 'Q5', 'A3', 'Q3', 'A6', 'Q7'],
  Subaru:         ['Impreza', 'Forester', 'Outback', 'XV', 'Legacy', 'WRX'],
  Mitsubishi:     ['Outlander', 'Montero', 'L200', 'Eclipse Cross', 'Lancer'],
}

function getModelSuggestions(brand: string, query: string): string[] {
  const models = MODELS_BY_BRAND[brand] ?? Object.values(MODELS_BY_BRAND).flat()
  return models.filter(m => m.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
}

// API returns Decimal as string — wrap in Number() to prevent string concatenation
function getServicePrice(service: Service, type: VehicleType): number {
  if (type === 'camion_estandar') return Number(service.price_camion_estandar ?? service.price_automovil)
  if (type === 'camion_xl')       return Number(service.price_camion_xl       ?? service.price_automovil)
  return Number(service.price_automovil)
}

export default function IngresarServicio() {
  const navigate = useNavigate()
  const { services, operators, createOrder } = useAppContext()

  const [step, setStep]           = useState<Step>(1)
  const [prevStep, setPrevStep]   = useState<Step>(1)
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<OrderDraft>({
    plate: '', brand: '', model: '', color: '',
    clientName: '', clientPhone: '',
    operatorId: null,
    selectedServices: [], notes: '',
  })

  // Brand autocomplete
  const [brandQuery, setBrandQuery]     = useState('')
  const [showBrandSug, setShowBrandSug] = useState(false)
  const brandRef = useRef<HTMLDivElement>(null)
  const filteredBrands = BRANDS.filter(b => b.toLowerCase().includes(brandQuery.toLowerCase()))

  // Model autocomplete
  const [showModelSug, setShowModelSug] = useState(false)
  const modelRef = useRef<HTMLDivElement>(null)
  const modelSuggestions = getModelSuggestions(form.brand, form.model)

  function goTo(next: Step) {
    setPrevStep(step)
    setStep(next)
  }

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setForm(f => ({ ...f, plate: val }))
  }

  async function handlePlateBlur() {
    if (form.plate.length < 3) return
    try {
      const found = await api.vehicles.byPlate(form.plate)
      setForm(f => ({
        ...f,
        brand: found.brand ?? f.brand,
        model: found.model ?? f.model,
        color: found.color ?? f.color,
      }))
      if (found.brand) {
        setBrandQuery(found.brand)
        toast.info(`Vehículo encontrado: ${found.brand} ${found.model ?? ''}`)
      }
    } catch {
      // 404 = vehicle not registered, that's fine
    }
  }

  function handleReviewOrder() {
    if (!form.plate)        { toast.error('La placa es obligatoria'); return }
    if (!form.brand)        { toast.error('La marca es obligatoria'); return }
    if (!form.clientName)   { toast.error('El nombre del cliente es obligatorio'); return }
    if (!form.clientPhone)  { toast.error('El teléfono del cliente es obligatorio'); return }
    if (form.selectedServices.length === 0) { toast.error('Selecciona al menos un servicio'); return }
    goTo(3)
  }

  function toggleService(id: number) {
    setForm(f => ({
      ...f,
      selectedServices: f.selectedServices.includes(id)
        ? f.selectedServices.filter(s => s !== id)
        : [...f.selectedServices, id],
    }))
  }

  function getPrice(service: Service): number {
    return vehicleType ? getServicePrice(service, vehicleType) : service.price_automovil
  }

  const total = form.selectedServices.reduce((sum, id) => {
    const s = services.find(s => s.id === id)
    return sum + (s ? getPrice(s) : 0)
  }, 0)

  const selectedServiceObjs = form.selectedServices.map(id => services.find(s => s.id === id)!).filter(Boolean)

  async function handleConfirm() {
    if (!vehicleType || submitting) return
    setSubmitting(true)
    try {
      const orderNumber = await createOrder({
        vehicleType,
        plate:       form.plate,
        brand:       form.brand,
        model:       form.model,
        color:       form.color,
        clientName:  form.clientName,
        clientPhone: form.clientPhone,
        operatorId:  form.operatorId,
        serviceIds:  form.selectedServices,
        notes:       form.notes || undefined,
      })
      toast.success(`Orden ${orderNumber} creada`, {
        description: `${form.plate} · ${form.clientName} → Estado de Patio`,
      })
      // Reset
      setStep(1); setPrevStep(1); setVehicleType(null)
      setForm({ plate: '', brand: '', model: '', color: '', clientName: '', clientPhone: '', operatorId: null, selectedServices: [], notes: '' })
      setBrandQuery('')
      navigate('/patio')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la orden')
    } finally {
      setSubmitting(false)
    }
  }

  const direction = step > prevStep ? 1 : -1

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step indicator */}
      {step > 1 && (
        <div className="flex items-center justify-center gap-0 mb-8">
          {([1, 2, 3] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                step === s ? 'bg-yellow-500 text-gray-950 shadow-lg shadow-yellow-500/30' :
                step > s   ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                              'bg-white/8 text-gray-500 border border-white/10'
              )}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {i < 2 && (
                <div className={cn('w-16 h-px mx-1 transition-colors duration-500', step > s ? 'bg-green-500/40' : 'bg-white/10')} />
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -40 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* STEP 1 — Vehicle Type */}
          {step === 1 && (
            <div>
              <h1 className="text-3xl font-semibold text-white text-center mb-2">Nuevo Servicio</h1>
              <p className="text-gray-400 text-center mb-10">Selecciona el tipo de vehículo</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                {vehicleOptions.map(opt => (
                  <motion.button
                    key={opt.type}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setVehicleType(opt.type); goTo(2) }}
                    className={cn(
                      'group flex flex-col items-center gap-5 rounded-2xl border p-8 text-center transition-all duration-200',
                      'bg-white/[0.03] border-white/8 hover:border-yellow-500/40 hover:bg-yellow-500/5',
                      'hover:shadow-lg hover:shadow-yellow-500/10'
                    )}
                  >
                    <div className="text-gray-400 group-hover:text-yellow-400 transition-colors duration-200">
                      {opt.icon}
                    </div>
                    <div>
                      <div className="text-lg font-medium text-white group-hover:text-yellow-300 transition-colors">{opt.label}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{opt.sub}</div>
                    </div>
                    <ChevronRight size={18} className="text-gray-600 group-hover:text-yellow-500 transition-colors" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Form */}
          {step === 2 && vehicleType && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => goTo(1)} className="text-sm text-gray-400 hover:text-yellow-400 transition-colors">
                  ← Cambiar tipo
                </button>
                <span className="text-gray-700">|</span>
                <span className="text-sm text-gray-300">
                  {vehicleType === 'automovil' ? 'Automóvil' : vehicleType === 'camion_estandar' ? 'Camioneta Estándar' : 'Camioneta XL'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
                {/* Col 1 — Vehículo & Cliente */}
                <div className="space-y-3">
                  <GlassCard padding className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Vehículo</h3>

                    <div className="space-y-1">
                      <Input label="Placa *" id="plate" value={form.plate}
                        placeholder="ABC123"
                        onChange={handlePlateChange}
                        onBlur={handlePlateBlur}
                        leftIcon={<Hash size={14} />} />
                      <p className="text-[11px] text-gray-600 pl-1">Solo letras y números, máximo 6 caracteres</p>
                    </div>

                    <div className="relative" ref={brandRef}>
                      <Input label="Marca *" id="brand" value={form.brand} placeholder="Toyota"
                        onChange={e => {
                          const v = e.target.value
                          setForm(f => ({ ...f, brand: v }))
                          setBrandQuery(v)
                          setShowBrandSug(true)
                        }}
                        onFocus={() => setShowBrandSug(true)}
                        onBlur={() => setTimeout(() => setShowBrandSug(false), 150)}
                        leftIcon={<Search size={14} />} />
                      <AnimatePresence>
                        {showBrandSug && filteredBrands.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute z-20 w-full mt-1 rounded-xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden"
                          >
                            {filteredBrands.slice(0, 6).map(b => (
                              <button key={b}
                                onMouseDown={() => { setForm(f => ({ ...f, brand: b })); setBrandQuery(b); setShowBrandSug(false) }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/8 transition-colors">
                                {b}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="relative" ref={modelRef}>
                      <Input label="Modelo" id="model" value={form.model} placeholder="Corolla 2020"
                        onChange={e => {
                          setForm(f => ({ ...f, model: e.target.value }))
                          setShowModelSug(true)
                        }}
                        onFocus={() => setShowModelSug(true)}
                        onBlur={() => setTimeout(() => setShowModelSug(false), 150)} />
                      <AnimatePresence>
                        {showModelSug && modelSuggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute z-20 w-full mt-1 rounded-xl border border-white/10 bg-gray-900 shadow-2xl overflow-hidden"
                          >
                            {modelSuggestions.map(m => (
                              <button key={m}
                                onMouseDown={() => { setForm(f => ({ ...f, model: m })); setShowModelSug(false) }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/8 transition-colors">
                                {m}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <Input label="Color" id="color" value={form.color} placeholder="Blanco"
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      leftIcon={<Palette size={14} />} />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-300">Fecha</label>
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400">
                        <Calendar size={14} className="shrink-0" />
                        <span>{TODAY}</span>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard padding className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Cliente</h3>
                    <div className="space-y-1">
                      <Input label="Nombre *" id="client-name" value={form.clientName}
                        placeholder="Nombre completo"
                        onChange={e => setForm(f => ({ ...f, clientName: e.target.value.slice(0, 60) }))}
                        leftIcon={<User size={14} />} />
                      {form.clientName.length >= 60 && (
                        <p className="text-[11px] text-red-400 pl-1">Máximo 60 caracteres</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Input label="Teléfono *" id="client-phone" value={form.clientPhone}
                        placeholder="555-1234"
                        onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value.slice(0, 15) }))}
                        leftIcon={<Phone size={14} />} />
                      {form.clientPhone.length >= 15 && (
                        <p className="text-[11px] text-red-400 pl-1">Máximo 15 caracteres</p>
                      )}
                    </div>
                    <Select
                      label="Operario (opcional)"
                      value={form.operatorId ? String(form.operatorId) : '0'}
                      onValueChange={v => setForm(f => ({ ...f, operatorId: v === '0' ? null : Number(v) }))}
                      options={[
                        { value: '0', label: 'Sin asignar' },
                        ...operators.map(op => ({ value: String(op.id), label: op.name })),
                      ]}
                    />
                  </GlassCard>
                </div>

                {/* Col 2 — Services */}
                <div className="space-y-3">
                  {(['exterior', 'interior', 'ceramico'] as const).map(cat => (
                    <div key={cat}>
                      <div className={cn('rounded-xl border p-3 space-y-1', categoryColors[cat])}>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          {categoryLabels[cat]}
                        </h3>
                        {services.filter(s => s.category === cat).map(service => {
                          const price   = getPrice(service)
                          const checked = form.selectedServices.includes(service.id)
                          return (
                            <motion.label key={service.id} whileHover={{ x: 2 }}
                              className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                              <input type="checkbox" checked={checked} onChange={() => toggleService(service.id)}
                                className="w-4 h-4 rounded accent-yellow-400 cursor-pointer" />
                              <span className="flex-1 text-sm text-gray-200">{service.name}</span>
                              <span className="text-sm font-medium text-yellow-400">${Number(price).toLocaleString('es-CO')}</span>
                            </motion.label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Col 3 — Summary + actions */}
                <div>
                  <GlassCard padding className="flex flex-col h-full lg:min-h-[500px]">
                    <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-4">Resumen</h3>

                    <div className="flex-1 space-y-2 overflow-y-auto">
                      {selectedServiceObjs.length === 0 ? (
                        <p className="text-sm text-gray-600 italic">Selecciona servicios...</p>
                      ) : (
                        <AnimatePresence>
                          {selectedServiceObjs.map(s => (
                            <motion.div key={s.id}
                              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                              className="flex justify-between items-center py-2 border-b border-white/6">
                              <span className="text-sm text-gray-300">{s.name}</span>
                              <span className="text-sm font-medium text-yellow-400">${getPrice(s)}</span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>

                    {total > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-gray-300">Total</span>
                        <motion.span key={total}
                          initial={{ scale: 1.15 }} animate={{ scale: 1 }}
                          className="text-2xl font-bold text-yellow-400"
                        >
                          ${total.toLocaleString('es-CO')}
                        </motion.span>
                      </div>
                    )}

                    <div className="mt-5 space-y-2">
                      <Button variant="primary" size="lg" className="w-full" onClick={handleReviewOrder}>
                        Revisar Orden →
                      </Button>
                      <Button variant="ghost" size="md" className="w-full" onClick={() => goTo(1)}>
                        Cancelar
                      </Button>
                    </div>
                  </GlassCard>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-semibold text-white text-center mb-2">Confirmar Orden</h2>
              <p className="text-gray-400 text-center mb-8">Revisa los detalles antes de guardar</p>

              <GlassCard padding className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vehículo</p>
                    <p className="text-white font-medium">{form.brand} {form.model}</p>
                    <p className="text-gray-400 text-sm">{form.plate}{form.color ? ` · ${form.color}` : ''}</p>
                    <p className="text-gray-500 text-sm mt-1">{TODAY}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cliente</p>
                    <p className="text-white font-medium">{form.clientName}</p>
                    <p className="text-gray-400 text-sm">{form.clientPhone}</p>
                    {form.operatorId && (
                      <p className="text-gray-400 text-sm mt-1">
                        Operario: {operators.find(o => o.id === form.operatorId)?.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/8 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Servicios</p>
                  <div className="space-y-2">
                    {selectedServiceObjs.map(s => (
                      <div key={s.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant={s.category === 'exterior' ? 'yellow' : s.category === 'interior' ? 'blue' : 'purple'}>
                            {categoryLabels[s.category]}
                          </Badge>
                          <span className="text-sm text-gray-200">{s.name}</span>
                        </div>
                        <span className="text-sm font-medium text-yellow-400">${getPrice(s)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/8">
                    <span className="text-lg text-gray-200 font-medium">Total</span>
                    <span className="text-3xl font-bold text-yellow-400">${total.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => goTo(2)} disabled={submitting}>
                    ← Editar
                  </Button>
                  <Button variant="primary" size="lg" className="flex-1" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? 'Guardando...' : <><Check size={18} /> Confirmar Orden</>}
                  </Button>
                </div>
              </GlassCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
