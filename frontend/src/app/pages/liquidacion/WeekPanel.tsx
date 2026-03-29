import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronDown, Check, Banknote,
} from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/app/components/ui/Button'
import { GlassCard } from '@/app/components/ui/GlassCard'
import { Badge } from '@/app/components/ui/Badge'
import { cn } from '@/app/components/ui/cn'
import type { ApiLiqWeekResponse } from '@/api'
import { cop, getWeekStart, PATIO_STATUS_LABEL } from './helpers'

interface WeekPanelProps {
  weekData: ApiLiqWeekResponse | null
  weekLoading: boolean
  weekOffset: number
  setWeekOffset: (fn: (prev: number) => number) => void
  openDays: Set<string>
  toggleDay: (dateStr: string) => void
  onLiquidarClick: () => void
  pendingLoading?: boolean
  noPending?: boolean
}

export function WeekPanel({
  weekData,
  weekLoading,
  weekOffset,
  setWeekOffset,
  openDays,
  toggleDay,
  onLiquidarClick,
  pendingLoading = false,
  noPending = false,
}: WeekPanelProps) {
  const weekStart = getWeekStart(weekOffset)
  const weekEnd   = addDays(weekStart, 6)

  return (
    <>
      {/* Week navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setWeekOffset(prev => prev - 1)}
          className="rounded-xl bg-white/5 p-2.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-gray-200">
            {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {weekOffset === 0 ? 'Semana actual' : weekOffset === -1 ? 'Semana pasada' : weekOffset < 0 ? `Hace ${Math.abs(weekOffset)} semanas` : `En ${weekOffset} semanas`}
          </p>
        </div>
        <button
          onClick={() => setWeekOffset(prev => prev + 1)}
          disabled={weekOffset >= 0}
          className="rounded-xl bg-white/5 p-2.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Week summary */}
      {weekData && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Servicios', value: weekData.week_services },
              weekData.operator_type === 'pintura'
                ? { label: `Base pintura`, value: `$${cop(weekData.commission_base)}` }
                : { label: 'Total', value: `$${cop(weekData.week_total)}` },
              weekData.operator_type === 'pintura'
                ? { label: `${weekData.piece_count ?? 0} piezas × $90.000`, value: `$${cop(weekData.commission_amount)}`, highlight: true }
                : weekData.operator_type === 'latoneria'
                ? { label: 'Pago latonería', value: `$${cop(weekData.commission_amount)}`, highlight: true }
                : { label: `Com. ${Number(weekData.commission_rate)}%`, value: `$${cop(weekData.commission_amount)}`, highlight: true },
            ].map(item => (
              <GlassCard key={item.label} padding className="text-center !px-2 !py-3">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1 leading-tight">{item.label}</p>
                <p className={cn('text-sm sm:text-lg font-bold truncate', item.highlight ? 'text-yellow-400' : 'text-white')}>
                  {item.value}
                </p>
              </GlassCard>
            ))}
          </div>

          {weekData.operator_type === 'detallado' && Number(weekData.ceramic_bonus_total ?? 0) > 0 && (
            <div className="flex justify-between text-xs text-amber-400/80 px-1 -mt-1">
              <span>Bonos cerámicos</span>
              <span>+${cop(weekData.ceramic_bonus_total!)}</span>
            </div>
          )}

          <div className="space-y-2">
            {weekData.is_liquidated && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-green-500/25 bg-green-500/8 py-2.5">
                  <Check size={14} className="text-green-400" />
                  <span className="text-sm text-green-400 font-medium">
                    {weekData.unliquidated_count === 0 ? 'Semana completamente liquidada' : 'Semana parcialmente liquidada'}
                    {weekData.liquidated_at && (
                      <span className="text-green-600 font-normal ml-2">
                        · {format(new Date(weekData.liquidated_at), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                  </span>
                </div>
                {/* Payment breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {weekData.net_amount && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Neto pagado</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.net_amount)}</p>
                    </div>
                  )}
                  {Number(weekData.payment_cash_amount) > 0 && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Efectivo</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.payment_cash_amount!)}</p>
                    </div>
                  )}
                  {Number(weekData.payment_datafono_amount) > 0 && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Banco Caja Social</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.payment_datafono_amount!)}</p>
                    </div>
                  )}
                  {Number(weekData.payment_nequi_amount) > 0 && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Nequi</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.payment_nequi_amount!)}</p>
                    </div>
                  )}
                  {Number(weekData.payment_bancolombia_amount) > 0 && (
                    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-center">
                      <p className="text-gray-600">Bancolombia</p>
                      <p className="text-gray-200 font-semibold">${cop(weekData.payment_bancolombia_amount!)}</p>
                    </div>
                  )}
                  {Number(weekData.amount_pending) > 0 && (
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-center">
                      <p className="text-orange-600">Pendiente</p>
                      <p className="text-orange-400 font-semibold">${cop(weekData.amount_pending!)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <Button
              variant={noPending ? 'secondary' : 'primary'}
              size="md" className="w-full"
              onClick={onLiquidarClick}
              disabled={pendingLoading || noPending}
            >
              <Banknote size={16} />
              {pendingLoading ? 'Cargando...' : noPending ? 'Todo liquidado' : 'Liquidar servicios pendientes'}
            </Button>
          </div>
        </>
      )}

      {/* Daily accordion */}
      <div className="space-y-2">
        {weekLoading && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-gray-500">Cargando semana...</p>
          </div>
        )}
        {weekData && weekData.days.map(day => {
          const isOpen    = openDays.has(day.date)
          const hasOrders = day.day_services > 0
          const dayDate   = parseISO(day.date)

          return (
            <div key={day.date} className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => hasOrders && toggleDay(day.date)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                  hasOrders ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[36px]">
                    <p className="text-xs text-gray-500">{day.day_name.slice(0, 3)}</p>
                    <p className="text-base font-semibold text-white">{format(dayDate, 'd')}</p>
                  </div>
                  <div>
                    {hasOrders ? (
                      <>
                        <p className="text-sm text-gray-200 font-medium">{day.day_services} servicio{day.day_services !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-400">
                          ${cop(day.day_total)}
                          {weekData.operator_type === 'pintura' ? (() => {
                            const pieces = day.orders.reduce((s, o) => s + Number(o.piece_count ?? 0), 0)
                            return pieces > 0 ? (
                              <span className="text-yellow-500 ml-2">
                                · {pieces} pieza{pieces !== 1 ? 's' : ''} × $90.000
                              </span>
                            ) : null
                          })() : Number(day.day_total) > 0 && weekData.operator_type !== 'latoneria' ? (() => {
                            const dayComm = day.orders.reduce((s, o) =>
                              s + Number(o.commission_base ?? o.total) * Number(weekData.commission_rate) / 100
                                + Number(o.ceramic_bonus ?? 0)
                            , 0)
                            return (
                              <span className="text-yellow-500 ml-2">
                                · comisión ${cop(dayComm.toFixed(0))}
                              </span>
                            )
                          })() : null}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">Sin servicios</p>
                    )}
                  </div>
                </div>
                {hasOrders && (
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={16} className="text-gray-500" />
                  </motion.div>
                )}
              </button>

              <AnimatePresence initial={false}>
                {isOpen && hasOrders && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-2 border-t border-white/6">
                      {day.orders.map(order => (
                        <div key={order.order_id} className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-gray-400">{order.order_number}</span>
                                <span className="text-sm text-gray-200">{order.vehicle_brand} {order.vehicle_model}</span>
                                <span className="text-xs text-gray-500">{order.vehicle_plate}</span>
                                <Badge variant={order.patio_status === 'entregado' ? 'green' : order.patio_status === 'listo' ? 'blue' : 'orange'} className="text-[10px]">
                                  {PATIO_STATUS_LABEL[order.patio_status] ?? order.patio_status}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-1.5 mt-1">
                                {order.items.map((item, i) => (
                                  <span key={i} className="text-xs text-gray-600">{item.service_name}{i < order.items.length - 1 ? ' ·' : ''}</span>
                                ))}
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-yellow-400 shrink-0">${cop(order.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </>
  )
}
