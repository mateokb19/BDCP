import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/app/components/ui/cn'
import type { ApiPatioEntry } from '@/api'

interface MinimapPanelProps {
  entries: ApiPatioEntry[]
}

// Vehicle slot positions as percentage coordinates within the floor plan
const SLOTS = [
  // Zona 1 — Pintura/Latonería (2 slots, vertical center divider)
  { x: 25, y: 10 }, { x: 75, y: 10 },
  // Zona 2 — Lavado fila 1 (3 cols)
  { x: 17, y: 30 }, { x: 50, y: 30 }, { x: 83, y: 30 },
  // Zona 3 — Lavado fila 2 (3 cols)
  { x: 17, y: 50 }, { x: 50, y: 50 }, { x: 83, y: 50 },
  // Zona 4 — Detallado (3 left + 1 right)
  { x: 27, y: 64 }, { x: 27, y: 70 }, { x: 27, y: 76 }, { x: 75, y: 70 },
  // Cuarto inferior (2 left + 1 right)
  { x: 27, y: 86 }, { x: 27, y: 93 }, { x: 75, y: 89 },
]

const CAP = 15

export function MinimapPanel({ entries }: MinimapPanelProps) {
  const active = entries.filter(e => e.status !== 'entregado').length
  const occ    = Math.min(active, CAP)
  const ov     = Math.max(0, active - CAP)
  const cc     = active >= CAP ? 'text-red-400'  : active >= 10 ? 'text-yellow-400' : 'text-green-400'
  const bc     = active >= CAP ? 'bg-red-500'    : active >= 10 ? 'bg-yellow-500'   : 'bg-green-500'

  return (
    <div
      className="hidden xl:flex flex-col gap-2 sticky top-4 shrink-0 rounded-2xl border border-white/8 bg-white/[0.03] p-3"
      style={{ width: 200 }}
    >
      {/* Header */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-gray-500">Bodega</span>
        <span className={cn('text-[10px] font-bold tabular-nums', cc)}>{active}/{CAP}</span>
        {ov > 0 && (
          <span className="text-[9px] font-semibold bg-red-500/15 border border-red-500/30 text-red-400 rounded-full px-1 leading-none py-0.5">
            +{ov}
          </span>
        )}
        <div className="flex-1 h-0.5 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            animate={{ width: `${Math.min(100, (active / CAP) * 100)}%` }}
            transition={{ duration: 0.5 }}
            className={cn('h-full rounded-full', bc)}
          />
        </div>
      </div>

      {/* Floor plan */}
      <div
        className="relative w-full rounded border border-white/10 bg-gray-950 overflow-hidden"
        style={{ height: 300 }}
      >
        {/* Vertical divider — Pintura/Latonería zone */}
        <div className="absolute top-0 border-r border-white/15" style={{ left: '50%', height: '20%' }} />
        {/* Dashed separator: top zone / lavado */}
        <div className="absolute left-0 right-0" style={{ top: '20%', borderTop: '1px dashed rgba(255,255,255,0.12)' }} />
        {/* Dashed separator: lavado / detallado */}
        <div className="absolute left-0 right-0" style={{ top: '59%', borderTop: '1px dashed rgba(255,255,255,0.12)' }} />
        {/* Solid separator: main body / lower room */}
        <div className="absolute left-0 right-0 border-t border-white/20" style={{ top: '80%' }} />

        {/* Vehicle slots */}
        {SLOTS.map((pos, i) => {
          const occupied = i < occ
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10 }}
            >
              <AnimatePresence mode="wait">
                {occupied ? (
                  <motion.div
                    key="occ"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="w-full h-full rounded-sm bg-yellow-400/70"
                  />
                ) : (
                  <motion.div
                    key="emp"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full rounded-sm border border-white/15"
                  />
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
