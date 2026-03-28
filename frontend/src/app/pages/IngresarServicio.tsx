import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Car, Truck, Bike, Check, ChevronRight, Search, User, Phone, Palette, Hash, Calendar, Pencil, AlertTriangle, ShieldCheck, Sparkles, Wrench, Paintbrush, Shield, Layers } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/Button'
import { Input } from '@/app/components/ui/Input'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { Badge } from '@/app/components/ui/Badge'
import { cn } from '@/app/components/ui/cn'
import { api, type ApiAppointment } from '@/api'
import { useAppContext } from '@/app/context/AppContext'
import type { VehicleType, Service } from '@/types'

// ── Currency helpers ─────────────────────────────────────────────────────────
const parseCOP = (s: string) => s.replace(/\D/g, '')
const fmtCOP   = (raw: string | number): string => {
  const str = typeof raw === 'number' ? String(raw) : raw
  const n   = Number(parseCOP(str))
  return str === '' || isNaN(n) ? '' : n.toLocaleString('es-CO')
}

type Step = 1 | 2 | 3

interface OrderDraft {
  plate: string
  brand: string
  model: string
  color: string
  clientName: string
  clientPhone: string
  selectedServices: number[]
  notes: string
  deliveryDate: string
  deliveryTime: string
  customPrices: Record<number, string>
  warrantyServiceIds: number[]
  downpayment: string
  downpaymentMethod: string
  isWarranty: boolean
}

const _d = new Date()
const TODAY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

const vehicleOptions: { type: VehicleType; label: string; icon: React.ReactNode }[] = [
  { type: 'moto',            label: 'Moto',               icon: <Bike size={44} /> },
  { type: 'automovil',       label: 'Automóvil',          icon: <Car size={48} /> },
  { type: 'camion_estandar', label: 'Camioneta Estándar', icon: <Truck size={48} /> },
  { type: 'camion_xl',       label: 'Camioneta XL',       icon: <Truck size={52} /> },
]

const categoryColors: Record<string, string> = {
  exterior:           'bg-yellow-500/10 border-yellow-500/20',
  interior:           'bg-blue-500/10 border-blue-500/20',
  ceramico:           'bg-purple-500/10 border-purple-500/20',
  correccion_pintura: 'bg-orange-500/10 border-orange-500/20',
  latoneria:          'bg-blue-500/10 border-blue-500/20',
  pintura:            'bg-orange-500/10 border-orange-500/20',
  ppf:                'bg-purple-500/10 border-purple-500/20',
  polarizado:         'bg-cyan-500/10 border-cyan-500/20',
}
const categoryLabels: Record<string, string> = {
  exterior:           'Exterior',
  interior:           'Interior',
  ceramico:           'Cerámico',
  correccion_pintura: 'Corrección',
  latoneria:          'Latonería',
  pintura:            'Pintura',
  ppf:                'PPF',
  polarizado:         'Polarizado',
}

type AreaId = 'detallado' | 'latoneria' | 'pintura' | 'ppf' | 'polarizado'

const VEHICLE_LABELS: Record<string, string> = {
  moto:            'Moto',
  automovil:       'Automóvil',
  camion_estandar: 'Camioneta Estándar',
  camion_xl:       'Camioneta XL',
}

const AREAS: { id: AreaId; label: string; iconClass: string }[] = [
  { id: 'detallado',  label: 'Detallado',  iconClass: 'text-gray-400 group-hover:text-yellow-400' },
  { id: 'ppf',        label: 'PPF',        iconClass: 'text-gray-400 group-hover:text-purple-400' },
  { id: 'polarizado', label: 'Polarizado', iconClass: 'text-gray-400 group-hover:text-cyan-400' },
  { id: 'latoneria',  label: 'Latonería',  iconClass: 'text-gray-400 group-hover:text-blue-400' },
  { id: 'pintura',    label: 'Pintura',    iconClass: 'text-gray-400 group-hover:text-orange-400' },
]

const AREA_ICONS_SM: Record<AreaId, React.ReactNode> = {
  detallado:  <Sparkles size={15} />,
  latoneria:  <Wrench size={15} />,
  pintura:    <Paintbrush size={15} />,
  ppf:        <Shield size={15} />,
  polarizado: <Layers size={15} />,
}

const AREA_CATEGORIES: Record<AreaId, string[]> = {
  detallado:  ['exterior', 'interior', 'ceramico', 'correccion_pintura'],
  latoneria:  ['latoneria'],
  pintura:    ['pintura'],
  ppf:        ['ppf'],
  polarizado: ['polarizado'],
}

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
  const location = useLocation()
  const { services, createOrder } = useAppContext()

  // Pre-fill from appointment if navigated from CalendarioCitas
  const fromAppt = (location.state as { fromAppointment?: ApiAppointment } | null)?.fromAppointment

  const [step, setStep]               = useState<Step>(fromAppt?.vehicle_type ? 2 : 1)
  const [prevStep, setPrevStep]       = useState<Step>(1)
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(
    fromAppt?.vehicle_type as VehicleType ?? null
  )
  const [expandedAreas, setExpandedAreas] = useState<Set<AreaId>>(new Set())
  const [partQuantities, setPartQuantities] = useState<Record<number, number>>({})
  const [submitting, setSubmitting]   = useState(false)
  const [plateTypeMismatch, setPlateTypeMismatch] = useState(false)
  const [form, setForm] = useState<OrderDraft>({
    plate:       fromAppt?.plate?.toUpperCase() ?? '',
    brand:       fromAppt?.brand ?? '',
    model:       fromAppt?.model ?? '',
    color:       '',
    clientName:  fromAppt?.client_name ?? '',
    clientPhone: fromAppt?.client_phone ?? '',
    selectedServices: [], notes: '',
    deliveryDate: '', deliveryTime: '',
    customPrices: {}, warrantyServiceIds: [], downpayment: '', downpaymentMethod: '', isWarranty: false,
  })

  // Brand autocomplete
  const [brandQuery, setBrandQuery]     = useState(fromAppt?.brand ?? '')
  const [showBrandSug, setShowBrandSug] = useState(false)
  const brandRef = useRef<HTMLDivElement>(null)
  const filteredBrands = BRANDS.filter(b => b.toLowerCase().includes(brandQuery.toLowerCase()))

  // Model autocomplete
  const [showModelSug, setShowModelSug] = useState(false)
  const modelRef = useRef<HTMLDivElement>(null)
  const modelSuggestions = getModelSuggestions(form.brand, form.model)

  // Price editing
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null)

  // Hour picker dropdown
  const [showHourPicker, setShowHourPicker] = useState(false)
  const HOURS = Array.from({ length: 10 }, (_, i) => i + 8)

  function goTo(next: Step) {
    setPrevStep(step)
    setStep(next)
  }

  function toggleArea(id: AreaId) {
    setExpandedAreas(prev => prev.has(id) ? new Set() : new Set([id]))
  }

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    // Clear auto-filled vehicle + client fields when plate is edited
    setForm(f => ({
      ...f, plate: val,
      brand: '', model: '', color: '',
      clientName: '', clientPhone: '',
    }))
    setBrandQuery('')
    setPlateTypeMismatch(false)
  }

  async function handlePlateBlur() {
    if (form.plate.length < 3) return
    try {
      const found = await api.vehicles.byPlate(form.plate)
      const typeMatches = found.type === vehicleType

      // Req 1: type mismatch — warn and don't fill vehicle fields
      if (!typeMatches) {
        setPlateTypeMismatch(true)
        toast.warning(
          `Esta placa está registrada como ${VEHICLE_LABELS[found.type] ?? found.type}. ` +
          `Cambia el tipo de vehículo para continuar.`,
          { duration: 5000 }
        )
        // Still fill client (plate is unique to one person, always bring their info)
        if (found.client) {
          setForm(f => ({
            ...f,
            clientName:  found.client!.name,
            clientPhone: found.client!.phone ?? f.clientPhone,
          }))
        }
        return
      }

      setPlateTypeMismatch(false)
      // Type matches — fill vehicle + client
      setForm(f => ({
        ...f,
        brand:       found.brand         ?? f.brand,
        model:       found.model         ?? f.model,
        color:       found.color         ?? f.color,
        clientName:  found.client?.name  ?? f.clientName,
        clientPhone: found.client?.phone ?? f.clientPhone,
      }))
      if (found.brand) setBrandQuery(found.brand)
      toast.info(`Vehículo encontrado: ${found.brand} ${found.model ?? ''}`)
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleService(id: number) {
    setForm(f => ({
      ...f,
      selectedServices: f.selectedServices.includes(id)
        ? f.selectedServices.filter(s => s !== id)
        : [...f.selectedServices, id],
    }))
  }

  function hasPartSelector(service: Service): boolean {
    return service.category === 'polarizado' || service.name.toLowerCase().includes('parcial')
  }
  function getPartQty(id: number): number {
    return partQuantities[id] ?? 1
  }

  function getStandardPrice(service: Service): number {
    return vehicleType ? getServicePrice(service, vehicleType) : Number(service.price_automovil)
  }
  function getEffectivePrice(service: Service): number {
    if (form.warrantyServiceIds.includes(service.id)) return 0
    const qty = hasPartSelector(service) ? getPartQty(service.id) : 1
    const custom = form.customPrices[service.id]
    if (custom !== undefined && custom !== '') {
      const n = Number(custom)
      if (!isNaN(n) && n >= 0) return n * qty
    }
    return getStandardPrice(service) * qty
  }

  const total = form.selectedServices.reduce((sum, id) => {
    const s = services.find(s => s.id === id)
    return sum + (s ? getEffectivePrice(s) : 0)
  }, 0)
  const standardTotal = form.selectedServices.reduce((sum, id) => {
    const s = services.find(s => s.id === id)
    return sum + (s ? getStandardPrice(s) : 0)
  }, 0)
  const totalDiscount = standardTotal - total
  const abonoAmt = Number(form.downpayment) || 0
  const restante = Math.max(0, total - abonoAmt)

  const selectedServiceObjs = form.selectedServices.map(id => services.find(s => s.id === id)!).filter(Boolean)

  const latWithNoPrice = selectedServiceObjs.filter(s => {
    if (s.category !== 'latoneria') return false
    const custom = form.customPrices[s.id]
    const price = custom !== undefined && custom !== '' ? Number(custom) : Number(s.price_automovil)
    return price <= 0
  })

  async function handleConfirm() {
    if (!vehicleType || submitting || latWithNoPrice.length > 0) return
    setSubmitting(true)
    try {
      // Custom price overrides (skip if service is warranty — warranty takes precedence)
      const customOverrides = Object.entries(form.customPrices)
        .filter(([id, priceStr]) => {
          if (!priceStr || isNaN(Number(priceStr))) return false
          if (form.warrantyServiceIds.includes(Number(id))) return false
          const s = services.find(s => s.id === Number(id))
          if (!s) return false
          const qty = hasPartSelector(s) ? getPartQty(Number(id)) : 1
          return Number(priceStr) * qty !== getStandardPrice(s)
        })
        .map(([id, priceStr]) => {
          const s = services.find(s => s.id === Number(id))!
          const qty = hasPartSelector(s) ? getPartQty(Number(id)) : 1
          return { service_id: Number(id), unit_price: Number(priceStr) * qty }
        })

      // Warranty service overrides (price = 0)
      const warrantyOverrides = form.warrantyServiceIds
        .filter(id => form.selectedServices.includes(id))
        .map(id => ({ service_id: id, unit_price: 0 }))

      const itemOverrides = [...customOverrides, ...warrantyOverrides]

      const scheduledDeliveryAt = form.deliveryDate
        ? `${form.deliveryDate}T${form.deliveryTime || '00:00'}:00`
        : undefined

      const orderNumber = await createOrder({
        vehicleType,
        plate:        form.plate,
        brand:        form.brand,
        model:        form.model,
        color:        form.color,
        clientName:   form.clientName,
        clientPhone:  form.clientPhone,
        serviceIds:   form.selectedServices,
        notes:        form.notes || undefined,
        scheduledDeliveryAt,
        downpayment:       abonoAmt > 0 ? abonoAmt : undefined,
        downpaymentMethod: abonoAmt > 0 && form.downpaymentMethod ? form.downpaymentMethod : undefined,
        isWarranty:        form.isWarranty,
        itemOverrides: itemOverrides.length > 0 ? itemOverrides : undefined,
      })
      toast.success(`Orden ${orderNumber} creada`, {
        description: `${form.plate} · ${form.clientName} → Estado de Patio`,
      })
      // Auto-delete appointment if this order came from one
      if (fromAppt?.id) {
        api.appointments.delete(fromAppt.id).catch(() => {})
      }
      setStep(1); setPrevStep(1); setVehicleType(null); setExpandedAreas(new Set()); setPartQuantities({})
      setForm({ plate: '', brand: '', model: '', color: '', clientName: '', clientPhone: '', selectedServices: [], notes: '', deliveryDate: '', deliveryTime: '', customPrices: {}, warrantyServiceIds: [], downpayment: '', downpaymentMethod: '', isWarranty: false })
      setBrandQuery('')
      navigate('/')
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
                {vehicleOptions.map(opt => (
                  <motion.button
                    key={opt.type}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setVehicleType(opt.type); setPlateTypeMismatch(false); goTo(2) }}
                    className={cn(
                      'group flex flex-col items-center justify-center gap-5 rounded-2xl border p-8 text-center transition-all duration-200 min-h-[160px]',
                      'bg-white/[0.03] border-white/8 hover:border-yellow-500/40 hover:bg-yellow-500/5',
                      'hover:shadow-lg hover:shadow-yellow-500/10'
                    )}
                  >
                    <div className="text-gray-400 group-hover:text-yellow-400 transition-colors duration-200">
                      {opt.icon}
                    </div>
                    <div className="text-lg font-medium text-white group-hover:text-yellow-300 transition-colors">{opt.label}</div>
                    <ChevronRight size={18} className="text-gray-600 group-hover:text-yellow-500 transition-colors" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Form */}
          {step === 2 && vehicleType && (
            <div>
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <button onClick={() => { setPlateTypeMismatch(false); setVehicleType(null); goTo(1) }}
                  className="text-sm text-gray-400 hover:text-yellow-400 transition-colors">
                  ← Cambiar tipo
                </button>
                <span className="text-gray-700">|</span>
                <span className="text-sm text-gray-300">{VEHICLE_LABELS[vehicleType]}</span>
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

                    {/* Warranty toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
                      <div>
                        <span className="text-sm font-medium text-gray-200">Entrada por garantía</span>
                        <p className="text-xs text-gray-500 mt-0.5">Proceso previo sin costo adicional</p>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, isWarranty: !f.isWarranty }))}
                        className={cn('relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0', form.isWarranty ? 'bg-orange-500' : 'bg-white/10')}>
                        <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200', form.isWarranty && 'translate-x-4')} />
                      </button>
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
                        placeholder="+57 555-1234"
                        inputMode="tel"
                        onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value.replace(/[^0-9+]/g, '').slice(0, 15) }))}
                        leftIcon={<Phone size={14} />} />
                      {form.clientPhone.length >= 15 && (
                        <p className="text-[11px] text-red-400 pl-1">Máximo 15 caracteres</p>
                      )}
                    </div>
                  </GlassCard>
                </div>

                {/* Col 2 — Services */}
                <div className="space-y-3">
                  {plateTypeMismatch && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-4 flex flex-col items-center gap-2 text-center"
                    >
                      <AlertTriangle size={22} className="text-red-400" />
                      <p className="text-sm font-medium text-red-300">Tipo de vehículo incorrecto</p>
                      <p className="text-xs text-gray-500">
                        Esta placa no corresponde al tipo seleccionado.<br/>Cambia el tipo para habilitar los servicios.
                      </p>
                      <button
                        onClick={() => { setPlateTypeMismatch(false); goTo(1) }}
                        className="mt-1 text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors"
                      >
                        ← Cambiar tipo de vehículo
                      </button>
                    </motion.div>
                  )}
                  <div className={cn(plateTypeMismatch && 'opacity-25 pointer-events-none select-none', 'space-y-2')}>

                    <AnimatePresence initial={false}>
                    {AREAS.filter(a => expandedAreas.size === 0 || expandedAreas.has(a.id)).map(area => {
                      const isOpen = expandedAreas.has(area.id)
                      const selectedCount = form.selectedServices.filter(id => {
                        const svc = services.find(s => s.id === id)
                        return svc && AREA_CATEGORIES[area.id].includes(svc.category)
                      }).length

                      return (
                        <motion.div
                          key={area.id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="rounded-xl border border-white/8 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleArea(area.id)}
                            className="group w-full flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                          >
                            <span className={cn('shrink-0 transition-colors', area.iconClass)}>{AREA_ICONS_SM[area.id]}</span>
                            <span className="flex-1 text-sm font-medium text-gray-300 text-left">{area.label}</span>
                            {selectedCount > 0 && (
                              <span className="text-xs text-yellow-400 font-medium">{selectedCount} sel.</span>
                            )}
                            <ChevronRight size={14} className={cn('text-gray-600 transition-transform shrink-0', isOpen && 'rotate-90')} />
                          </button>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3 pt-2 border-t border-white/5 space-y-3">

                                  {/* ── DETALLADO: 4 sub-sections ──────────────────── */}
                                  {area.id === 'detallado' && (['exterior', 'interior', 'correccion_pintura', 'ceramico'] as const).map(cat => (
                                    <div key={cat} className={cn('rounded-xl border p-3', categoryColors[cat])}>
                                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{categoryLabels[cat]}</h3>
                                      <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                        {services.filter(s => s.category === cat).map(service => {
                                          const price   = getStandardPrice(service)
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

                                  {/* ── PPF / POLARIZADO: precio fijo en amarillo + stepper partes ── */}
                                  {(area.id === 'ppf' || area.id === 'polarizado') && (
                                    <div className={cn('rounded-xl border p-3', categoryColors[area.id])}>
                                      <div className="space-y-2">
                                        {services.filter(s => s.category === area.id).map(service => {
                                          const price     = getStandardPrice(service)
                                          const checked   = form.selectedServices.includes(service.id)
                                          const withParts = hasPartSelector(service)
                                          const qty       = getPartQty(service.id)
                                          return (
                                            <div key={service.id} className="space-y-1.5">
                                              <motion.label whileHover={{ x: 2 }}
                                                className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                                                <input type="checkbox" checked={checked} onChange={() => toggleService(service.id)}
                                                  className="w-4 h-4 rounded accent-yellow-400 cursor-pointer shrink-0" />
                                                <span className="flex-1 text-sm text-gray-200">{service.name}</span>
                                                <span className="text-sm font-medium text-yellow-400">${price.toLocaleString('es-CO')}</span>
                                              </motion.label>
                                              {withParts && (
                                                <div className="flex items-center gap-2 pl-7">
                                                  <span className="text-xs text-gray-500 shrink-0">Partes:</span>
                                                  <div className="flex items-center gap-1.5">
                                                    <button type="button"
                                                      onClick={() => setPartQuantities(p => ({ ...p, [service.id]: Math.max(1, (p[service.id] ?? 1) - 1) }))}
                                                      className="w-6 h-6 rounded-md border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 flex items-center justify-center text-sm font-bold transition-colors">−</button>
                                                    <span className="text-sm text-gray-200 w-4 text-center">{qty}</span>
                                                    <button type="button"
                                                      disabled={service.category === 'polarizado' && qty >= 7}
                                                      onClick={() => setPartQuantities(p => ({ ...p, [service.id]: Math.min(service.category === 'polarizado' ? 7 : Infinity, (p[service.id] ?? 1) + 1) }))}
                                                      className="w-6 h-6 rounded-md border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* ── PINTURA: pieces list + fixed prices ─────────── */}
                                  {area.id === 'pintura' && (
                                    <div className={cn('rounded-xl border p-3', categoryColors.pintura)}>
                                      <p className="text-[11px] text-gray-600 mb-3">½ pieza $220.000 · 1 pieza $430.000 · 2 piezas $860.000</p>
                                      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                                        {services.filter(s => s.category === 'pintura').map(service => {
                                          const price   = getStandardPrice(service)
                                          const checked = form.selectedServices.includes(service.id)
                                          const pieces  = price >= 800000 ? '2 piezas' : price >= 400000 ? '1 pieza' : '½ pieza'
                                          return (
                                            <motion.label key={service.id} whileHover={{ x: 2 }}
                                              className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                                              <input type="checkbox" checked={checked} onChange={() => toggleService(service.id)}
                                                className="w-4 h-4 rounded accent-yellow-400 cursor-pointer shrink-0" />
                                              <span className="flex-1 text-sm text-gray-200">{service.name}</span>
                                              <span className="text-xs text-gray-500 shrink-0">{pieces}</span>
                                              <span className="text-sm font-medium text-yellow-400 shrink-0">${price.toLocaleString('es-CO')}</span>
                                            </motion.label>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* ── LATONERÍA: checkbox + precio (edición en paso 3) ── */}
                                  {area.id === 'latoneria' && (
                                    <div className={cn('rounded-xl border p-3', categoryColors.latoneria)}>
                                      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                                        {services.filter(s => s.category === 'latoneria').map(service => {
                                          const price   = getStandardPrice(service)
                                          const checked = form.selectedServices.includes(service.id)
                                          return (
                                            <motion.label key={service.id} whileHover={{ x: 2 }}
                                              className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                                              <input type="checkbox" checked={checked} onChange={() => toggleService(service.id)}
                                                className="w-4 h-4 rounded accent-yellow-400 cursor-pointer shrink-0" />
                                              <span className="flex-1 text-sm text-gray-200">{service.name}</span>
                                              <span className="text-sm font-medium text-yellow-400">${price.toLocaleString('es-CO')}</span>
                                            </motion.label>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                    </AnimatePresence>

                  </div>
                </div>

                {/* Col 3 — Summary + actions */}
                <div>
                  <GlassCard padding className="flex flex-col h-full lg:sticky lg:top-4">
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
                              <span className="text-sm font-medium text-yellow-400">${Number(getEffectivePrice(s)).toLocaleString('es-CO')}</span>
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
                      <Button variant="primary" size="lg" className="w-full" onClick={handleReviewOrder} disabled={plateTypeMismatch}>
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
              <h2 className="text-2xl font-semibold text-white text-center mb-2">Revisar Orden</h2>
              <p className="text-gray-400 text-center mb-8">Confirma los detalles antes de guardar</p>

              <GlassCard padding className="space-y-5">
                {/* Vehicle + Client */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vehículo</p>
                    <p className="text-white font-medium break-words">{form.brand} {form.model}</p>
                    <p className="text-gray-400 text-sm">{form.plate}{form.color ? ` · ${form.color}` : ''}</p>
                    <p className="text-gray-500 text-sm mt-1">{TODAY}</p>
                    {form.isWarranty && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 rounded-full px-2.5 py-0.5 border border-orange-500/20">
                        Entrada por garantía
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cliente</p>
                    <p className="text-white font-medium break-words">{form.clientName}</p>
                    <p className="text-gray-400 text-sm break-all">{form.clientPhone}</p>
                  </div>
                </div>

                {/* Delivery date/time — optional */}
                <div className="border-t border-white/8 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Fecha de Entrega Acordada <span className="text-gray-600 normal-case">(opcional)</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 block mb-1.5">Fecha</label>
                      <input type="date" value={form.deliveryDate}
                        min={TODAY}
                        onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 [color-scheme:dark]" />
                    </div>
                    <div className="relative">
                      <label className="text-sm text-gray-400 block mb-1.5">Hora</label>
                      <button
                        type="button"
                        disabled={!form.deliveryDate}
                        onClick={() => setShowHourPicker(v => !v)}
                        className={cn(
                          'w-full rounded-xl border px-3 py-2 text-sm text-left flex items-center justify-between transition-colors',
                          'bg-white/5 border-white/10 text-gray-100',
                          showHourPicker && 'border-yellow-500/50 ring-2 ring-yellow-500/20',
                          !form.deliveryDate && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <span className={form.deliveryTime ? 'text-gray-100' : 'text-gray-500'}>
                          {form.deliveryTime ? `${Number(form.deliveryTime.split(':')[0])}:00` : '— Hora —'}
                        </span>
                        <ChevronRight size={14} className={cn('text-gray-500 transition-transform', showHourPicker && 'rotate-90')} />
                      </button>
                      <AnimatePresence>
                        {showHourPicker && form.deliveryDate && (
                          <motion.ul
                            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
                            transition={{ duration: 0.15 }}
                            style={{ transformOrigin: 'top' }}
                            className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-gray-900 shadow-xl shadow-black/40 overflow-hidden max-h-52 overflow-y-auto"
                          >
                            {HOURS.map(h => {
                              const val = `${String(h).padStart(2, '0')}:00`
                              const selected = form.deliveryTime === val
                              return (
                                <li key={h}>
                                  <button
                                    type="button"
                                    onClick={() => { setForm(f => ({ ...f, deliveryTime: val })); setShowHourPicker(false) }}
                                    className={cn(
                                      'w-full text-left px-4 py-2 text-sm transition-colors',
                                      selected
                                        ? 'bg-yellow-500/15 text-yellow-400 font-medium'
                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                    )}
                                  >
                                    {h}:00
                                  </button>
                                </li>
                              )
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Services with price editing */}
                <div className="border-t border-white/8 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Servicios</p>
                  <div className="space-y-2">
                    {selectedServiceObjs.map(s => {
                      const stdPrice       = getStandardPrice(s)
                      const isWarrantySvc  = form.warrantyServiceIds.includes(s.id)
                      const effPrice       = getEffectivePrice(s)          // 0 if warranty
                      const discAmt        = isWarrantySvc ? 0 : stdPrice - effPrice
                      const isEditingThis  = !isWarrantySvc && editingPriceId === s.id

                      function toggleWarrantySvc() {
                        setForm(f => ({
                          ...f,
                          warrantyServiceIds: isWarrantySvc
                            ? f.warrantyServiceIds.filter(id => id !== s.id)
                            : [...f.warrantyServiceIds, s.id],
                        }))
                        if (isWarrantySvc) return
                        // clear custom price if marking as warranty
                        setEditingPriceId(null)
                      }

                      return (
                        <div key={s.id} className={cn(
                          'rounded-xl border px-3 py-2.5 transition-colors',
                          isWarrantySvc ? 'border-orange-500/25 bg-orange-500/5' : 'border-white/6 bg-white/[0.02]'
                        )}>
                          {/* Row 1: badge + service name */}
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={
                              s.category === 'exterior' ? 'yellow' :
                              s.category === 'interior' ? 'blue' :
                              s.category === 'correccion_pintura' ? 'orange' :
                              s.category === 'latoneria' ? 'blue' :
                              s.category === 'pintura' ? 'orange' :
                              s.category === 'ppf' ? 'purple' :
                              s.category === 'polarizado' ? 'default' :
                              'purple'
                            } className="shrink-0">
                              {categoryLabels[s.category] ?? s.category}
                            </Badge>
                            <span className="text-sm text-gray-200 truncate">{s.name}</span>
                          </div>
                          {/* Row 2: price + actions (right-aligned) */}
                          <div className="flex items-center justify-end gap-2 mt-1.5">
                            {/* Warranty toggle — only when isWarranty flag is on */}
                            {form.isWarranty && (
                              <button onClick={toggleWarrantySvc}
                                title={isWarrantySvc ? 'Quitar garantía' : 'Marcar como garantía'}
                                className={cn(
                                  'p-1 rounded-lg transition-colors',
                                  isWarrantySvc
                                    ? 'text-orange-400 bg-orange-500/15'
                                    : 'text-gray-600 hover:text-orange-400 hover:bg-orange-500/10'
                                )}>
                                <ShieldCheck size={14} />
                              </button>
                            )}
                            {/* Price section */}
                            {isWarrantySvc ? (
                              <>
                                <span className="text-xs text-gray-500 line-through">${stdPrice.toLocaleString('es-CO')}</span>
                                <span className="text-sm font-medium text-orange-400">$0</span>
                              </>
                            ) : isEditingThis ? (
                              <input
                                type="text" inputMode="numeric"
                                value={fmtCOP(form.customPrices[s.id] ?? String(stdPrice))}
                                onChange={e => setForm(f => ({ ...f, customPrices: { ...f.customPrices, [s.id]: parseCOP(e.target.value) } }))}
                                onBlur={() => setEditingPriceId(null)}
                                onKeyDown={e => e.key === 'Enter' && setEditingPriceId(null)}
                                className="w-28 rounded-lg border border-yellow-500/40 bg-gray-900 px-2 py-1 text-sm text-yellow-400 text-right focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <>
                                {discAmt > 0 && (
                                  <span className="text-xs text-gray-500 line-through">${stdPrice.toLocaleString('es-CO')}</span>
                                )}
                                <span className={cn('text-sm font-medium', discAmt > 0 ? 'text-green-400' : 'text-yellow-400')}>
                                  ${effPrice.toLocaleString('es-CO')}
                                </span>
                                <button onClick={() => setEditingPriceId(s.id)}
                                  className="p-1 rounded-lg hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-colors" title="Editar precio">
                                  <Pencil size={12} />
                                </button>
                              </>
                            )}
                          </div>
                          {isWarrantySvc && (
                            <p className="text-xs text-orange-400/60 mt-0.5 text-right">Servicio en garantía · sin cobro</p>
                          )}
                          {!isWarrantySvc && discAmt > 0 && (
                            <p className="text-xs text-green-400/70 mt-0.5 text-right">
                              Descuento: −${discAmt.toLocaleString('es-CO')} ({Math.round((discAmt / stdPrice) * 100)}%)
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 pt-4 border-t border-white/8 space-y-1.5">
                    {totalDiscount > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Subtotal</span>
                          <span className="text-gray-300">${standardTotal.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-400">Descuentos</span>
                          <span className="text-green-400">−${totalDiscount.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-white/8">
                          <span className="text-gray-200 font-medium">Total</span>
                          <span className="text-2xl font-bold text-yellow-400">${total.toLocaleString('es-CO')}</span>
                        </div>
                      </>
                    )}
                    {totalDiscount <= 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-lg text-gray-200 font-medium">Total</span>
                        <span className="text-3xl font-bold text-yellow-400">${total.toLocaleString('es-CO')}</span>
                      </div>
                    )}
                  </div>

                  {/* Abono */}
                  <div className="mt-4 pt-4 border-t border-white/8">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Abono del Cliente <span className="text-gray-600 normal-case">(opcional)</span></p>
                      {total > 0 && (
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, downpayment: String(total) }))}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors',
                            abonoAmt === total && total > 0
                              ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-300'
                              : 'border-white/8 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]'
                          )}
                        >
                          <div className={cn('w-3 h-3 rounded border-2 shrink-0 flex items-center justify-center', abonoAmt === total && total > 0 ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600')}>
                            {abonoAmt === total && total > 0 && <svg viewBox="0 0 10 8" className="w-1.5 h-1.5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l2.5 2.5L9 1"/></svg>}
                          </div>
                          Abonar total
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="text" inputMode="numeric"
                          placeholder="0"
                          value={fmtCOP(form.downpayment)}
                          onChange={e => {
                            const raw = parseCOP(e.target.value)
                            const capped = raw === '' ? '' : String(Math.min(Number(raw), total))
                            setForm(f => ({ ...f, downpayment: capped }))
                          }}
                          className="w-full rounded-xl border border-white/10 bg-white/5 pl-7 pr-3 py-2 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
                        />
                      </div>
                      {abonoAmt > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">Restante</p>
                          <p className="text-lg font-bold text-orange-400">${restante.toLocaleString('es-CO')}</p>
                        </div>
                      )}
                    </div>
                    {abonoAmt > 0 && (
                      <div className="mt-2.5">
                        <p className="text-xs text-gray-500 mb-1.5">Método de pago del abono</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { key: 'Efectivo',          label: 'Efectivo' },
                            { key: 'Banco Caja Social', label: 'Banco Caja Social' },
                            { key: 'Nequi',             label: 'Nequi' },
                            { key: 'Bancolombia',       label: 'Bancolombia' },
                          ].map(m => {
                            const sel = form.downpaymentMethod === m.key
                            return (
                              <button
                                key={m.key} type="button"
                                onClick={() => setForm(f => ({ ...f, downpaymentMethod: sel ? '' : m.key }))}
                                className={cn(
                                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                                  sel ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-300' : 'border-white/8 bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]'
                                )}
                              >
                                <div className={cn('w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center', sel ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600')}>
                                  {sel && <svg viewBox="0 0 10 8" className="w-2 h-1.5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l2.5 2.5L9 1"/></svg>}
                                </div>
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" size="lg" className="flex-1" onClick={() => goTo(2)} disabled={submitting}>
                    ← Editar
                  </Button>
                  <Button variant="primary" size="lg" className="flex-1" onClick={handleConfirm}
                    disabled={submitting || latWithNoPrice.length > 0}>
                    {submitting ? 'Guardando...' : latWithNoPrice.length > 0 ? 'Ingresa el precio de latonería' : <><Check size={18} /> Confirmar Orden</>}
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
