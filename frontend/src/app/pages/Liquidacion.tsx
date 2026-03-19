import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Lock, Download, ChevronRight, ChevronLeft, Check, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader } from '@/app/components/ui/PageHeader'
import { Button } from '@/app/components/ui/Button'
import { Badge } from '@/app/components/ui/Badge'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { cn } from '@/app/components/ui/cn'
import {
  mockOperators, mockLiquidations, getLiquidationOrdersByLiquidationId,
  getOrderById, getVehicleById, getItemsByOrderId,
} from '@/data/mock'
import type { Liquidation } from '@/types'

const CORRECT_PASSWORD = 'BDCP123'

export default function LiquidacionPage() {
  const [unlocked, setUnlocked]       = useState(() => sessionStorage.getItem('liq_unlocked') === '1')
  const [pwd, setPwd]                 = useState('')
  const [shake, setShake]             = useState(false)
  const [selectedOp, setSelectedOp]   = useState<number | null>(null)
  const [liquidations, setLiquidations] = useState<Liquidation[]>(mockLiquidations)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pwd === CORRECT_PASSWORD) {
      sessionStorage.setItem('liq_unlocked', '1')
      setUnlocked(true)
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      toast.error('Contraseña incorrecta')
      setPwd('')
      inputRef.current?.focus()
    }
  }

  function markPaid(liqId: number) {
    setLiquidations(prev => prev.map(l =>
      l.id === liqId ? { ...l, status: 'pagada', paid_at: new Date().toISOString() } : l
    ))
    toast.success('Liquidación marcada como pagada')
  }

  // ---- Lock screen ----
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
                  ref={inputRef}
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

  // ---- Operator detail ----
  if (selectedOp !== null) {
    const operator = mockOperators.find(o => o.id === selectedOp)!
    const opLiquidations = liquidations.filter(l => l.operator_id === selectedOp)
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelectedOp(null)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors">
            <ChevronLeft size={16} /> Operarios
          </button>
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-5">
          {/* Main card */}
          <div className="space-y-5">
            {/* Operator header */}
            <GlassCard padding>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-yellow-500/15 p-4 text-2xl font-bold text-yellow-400 leading-none min-w-[56px] text-center">
                    {operator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{operator.name}</h2>
                    <p className="text-sm text-gray-500">{operator.phone} · Comisión {operator.commission_rate}%</p>
                  </div>
                </div>
                <Button variant="secondary" size="md" onClick={() => toast.info('Función disponible con backend')}>
                  <Download size={16} /> Descargar
                </Button>
              </div>
            </GlassCard>

            {/* Orders per liquidation */}
            {opLiquidations.map(liq => {
              const liqOrders = getLiquidationOrdersByLiquidationId(liq.id)
              return (
                <GlassCard key={liq.id} padding className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={14} className="text-gray-500" />
                      <span className="text-gray-300">
                        {format(parseISO(liq.period_start), "d MMM", { locale: es })} –{' '}
                        {format(parseISO(liq.period_end), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    <StatusBadge status={liq.status} />
                  </div>

                  <div className="space-y-2">
                    {liqOrders.map(lo => {
                      const order   = getOrderById(lo.order_id)
                      const vehicle = order ? getVehicleById(order.vehicle_id) : null
                      const items   = getItemsByOrderId(lo.order_id)
                      return (
                        <div key={lo.id} className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-400 font-mono">{order?.order_number}</span>
                              <span className="text-gray-600">·</span>
                              <span className="text-gray-300">{vehicle?.brand} {vehicle?.model}</span>
                              <span className="text-xs text-gray-500">{vehicle?.plate}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {items.map(i => (
                                <span key={i.id} className="text-xs text-gray-600">{i.service_name}</span>
                              )).reduce((acc: React.ReactNode[], el, idx, arr) =>
                                idx < arr.length - 1 ? [...acc, el, <span key={`sep-${idx}`} className="text-gray-700">·</span>] : [...acc, el], []
                              )}
                            </div>
                          </div>
                          <span className="text-yellow-400 font-semibold">${lo.order_total}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-t border-white/8 pt-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Servicios</p>
                      <p className="text-lg font-bold text-white">{liq.total_services}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Total Bruto</p>
                      <p className="text-lg font-bold text-white">${liq.total_amount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Comisión ({liq.commission_rate}%)</p>
                      <p className="text-lg font-bold text-yellow-400">${liq.commission_amount}</p>
                    </div>
                  </div>

                  {liq.status === 'pendiente' && (
                    <Button variant="primary" size="md" className="w-full" onClick={() => markPaid(liq.id)}>
                      <Check size={16} /> Marcar como Pagada
                    </Button>
                  )}
                  {liq.status === 'pagada' && liq.paid_at && (
                    <p className="text-xs text-gray-600 text-center">
                      Pagada el {format(parseISO(liq.paid_at), "d 'de' MMMM yyyy", { locale: es })}
                    </p>
                  )}
                </GlassCard>
              )
            })}
          </div>

          {/* Sidebar summary */}
          <div className="space-y-3">
            <GlassCard padding className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Resumen Total</h3>
              {[
                { label: 'Total servicios', value: opLiquidations.reduce((s, l) => s + l.total_services, 0), unit: 'servicios' },
                { label: 'Monto bruto', value: `$${opLiquidations.reduce((s, l) => s + l.total_amount, 0)}` },
                { label: 'Comisión total', value: `$${opLiquidations.reduce((s, l) => s + l.commission_amount, 0)}`, highlight: true },
              ].map(item => (
                <div key={item.label} className={cn(
                  'flex justify-between items-center py-2 border-b border-white/6',
                  item.highlight && 'border-b-0'
                )}>
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className={cn('font-semibold', item.highlight ? 'text-xl text-yellow-400' : 'text-white')}>
                    {item.value} {item.unit && <span className="text-xs text-gray-500">{item.unit}</span>}
                  </span>
                </div>
              ))}
            </GlassCard>

            {opLiquidations.map(l => (
              <div key={l.id} className={cn(
                'rounded-xl border px-4 py-3 flex items-center justify-between',
                l.status === 'pagada' ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5'
              )}>
                <div className="text-xs text-gray-400">
                  {format(parseISO(l.period_start), "d MMM", { locale: es })} – {format(parseISO(l.period_end), "d MMM", { locale: es })}
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- Operator grid ----
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Liquidación de Operarios" subtitle="Gestiona el pago de comisiones" />

      <div className="grid grid-cols-3 gap-4">
        {mockOperators.filter(o => o.active).map(operator => {
          const opLiqs    = liquidations.filter(l => l.operator_id === operator.id)
          const pending   = opLiqs.filter(l => l.status === 'pendiente')
          const totalAmt  = pending.reduce((s, l) => s + l.total_amount, 0)
          const totalCom  = pending.reduce((s, l) => s + l.commission_amount, 0)
          const totalSvc  = pending.reduce((s, l) => s + l.total_services, 0)

          return (
            <GlassCard key={operator.id} hover onClick={() => setSelectedOp(operator.id)} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-yellow-500/15 p-3 text-xl font-bold text-yellow-400 leading-none min-w-[48px] text-center">
                  {operator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="text-white font-medium">{operator.name}</div>
                  <div className="text-xs text-gray-500">Comisión {operator.commission_rate}%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-gray-600">Servicios</p>
                  <p className="text-lg font-bold text-white">{totalSvc}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-gray-600">Comisión</p>
                  <p className="text-lg font-bold text-yellow-400">${totalCom}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/8 pt-3">
                <div>
                  <p className="text-xs text-gray-600">Total bruto</p>
                  <p className="text-xl font-bold text-white">${totalAmt}</p>
                </div>
                <div className="flex items-center gap-1">
                  {pending.length > 0 && (
                    <Badge variant="orange">{pending.length} pendiente{pending.length > 1 ? 's' : ''}</Badge>
                  )}
                  <ChevronRight size={16} className="text-gray-500" />
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
