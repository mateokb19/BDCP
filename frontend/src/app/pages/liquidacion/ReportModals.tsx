import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { addDays } from 'date-fns'

interface ReportModalsProps {
  reportModalOpen: boolean
  setReportModalOpen: (open: boolean) => void
  customMonthOpen: boolean
  setCustomMonthOpen: (open: boolean) => void
  customMonthValue: string
  setCustomMonthValue: (value: string) => void
  weekStart: Date
  weekOffset: number
  onDownload: (period: 'week' | 'month', refDate: string) => void
  onDownloadCustomMonth: () => void
}

export function ReportModals({
  reportModalOpen,
  setReportModalOpen,
  customMonthOpen,
  setCustomMonthOpen,
  customMonthValue,
  setCustomMonthValue,
  weekStart,
  weekOffset,
  onDownload,
  onDownloadCustomMonth,
}: ReportModalsProps) {
  const weekEnd       = addDays(weekStart, 6)
  const weekStartStr  = format(weekStart, 'yyyy-MM-dd')
  const now           = new Date()
  const isCurrentMonth = weekStart.getFullYear() === now.getFullYear() && weekStart.getMonth() === now.getMonth()
  const monthBtnLabel = isCurrentMonth
    ? `Mes actual (hasta hoy)`
    : `Mes de ${format(weekStart, 'MMMM yyyy', { locale: es })}`
  const monthBtnSub   = isCurrentMonth
    ? `Del 1 al ${format(now, 'd')} de ${format(now, 'MMMM', { locale: es })}`
    : `Mes completo de ${format(weekStart, 'MMMM yyyy', { locale: es })}`

  return (
    <>
      {/* Report period picker modal */}
      <AnimatePresence>
        {reportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setReportModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.95,  y: 8  }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Generar reporte</h2>
                <button onClick={() => setReportModalOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-400">Selecciona el período del reporte:</p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => onDownload('week', weekStartStr)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 hover:border-yellow-500/30 transition-colors"
                >
                  <div className="rounded-lg bg-yellow-500/15 p-2">
                    <Download size={16} className="text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Esta semana</p>
                    <p className="text-xs text-gray-500">
                      {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => onDownload('month', weekStartStr)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 hover:border-yellow-500/30 transition-colors"
                >
                  <div className="rounded-lg bg-blue-500/15 p-2">
                    <Download size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{monthBtnLabel}</p>
                    <p className="text-xs text-gray-500 capitalize">{monthBtnSub}</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom month modal */}
      <AnimatePresence>
        {customMonthOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setCustomMonthOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.95,  y: 8  }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Factura por mes</h2>
                <button onClick={() => setCustomMonthOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-400">Elige el mes y año:</p>
              <input
                type="month"
                value={customMonthValue}
                onChange={e => setCustomMonthValue(e.target.value)}
                max={format(now, 'yyyy-MM')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 appearance-none"
              />
              <button
                onClick={onDownloadCustomMonth}
                disabled={!customMonthValue}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-gray-900 hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={15} />
                Generar factura
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
