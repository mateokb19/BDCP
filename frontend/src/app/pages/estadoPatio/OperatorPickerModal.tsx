import { motion } from 'framer-motion'
import { Button } from '@/app/components/ui/Button'
import { Select } from '@/app/components/ui/Select'
import type { ApiPatioEntry } from '@/api'
import { useAppContext } from '@/app/context/AppContext'

type Operators = ReturnType<typeof useAppContext>['operators']

interface OperatorPickerModalProps {
  operatorPickEntry:    ApiPatioEntry
  onClose:              () => void
  pickedOpId:           string
  setPickedOpId:        (id: string) => void
  entryNotes:           string
  setEntryNotes:        (notes: string) => void
  picking:              boolean
  activeOperators:      Operators
  onConfirm:            () => Promise<void>
}

export function OperatorPickerModal({
  operatorPickEntry, onClose,
  pickedOpId, setPickedOpId,
  entryNotes, setEntryNotes,
  picking, activeOperators,
  onConfirm,
}: OperatorPickerModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-4"
      >
        <div>
          <h3 className="text-base font-semibold text-white">Asignar Operario</h3>
          <p className="text-sm text-gray-500 mt-1">
            Para iniciar el proceso es necesario asignar un operario a{' '}
            <span className="text-gray-300">
              {operatorPickEntry.vehicle?.brand} {operatorPickEntry.vehicle?.plate}
            </span>.
          </p>
        </div>

        <Select
          label="Operario *"
          value={pickedOpId || '0'}
          onValueChange={v => setPickedOpId(v === '0' ? '' : v)}
          options={[
            { value: '0', label: 'Seleccionar operario...' },
            ...activeOperators.map(op => ({ value: String(op.id), label: op.name })),
          ]}
        />

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-400">
            Daños / piezas faltantes{' '}
            <span className="text-gray-600 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Ej: Rayón en puerta trasera derecha, tapón de gasolina roto..."
            value={entryNotes}
            onChange={e => setEntryNotes(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" className="flex-1"
            onClick={onConfirm}
            disabled={!pickedOpId || picking}>
            {picking ? 'Iniciando...' : 'Iniciar Proceso'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
