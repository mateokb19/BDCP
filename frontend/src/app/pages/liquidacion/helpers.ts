import { addWeeks, startOfWeek } from 'date-fns'

export const CORRECT_PASSWORD = 'BDCP123'

// ── Currency helpers ──────────────────────────────────────────────────────────
export const parseCOP = (s: string) => s.replace(/\D/g, '')
export const fmtCOP = (raw: string | number): string => {
  const str = typeof raw === 'number' ? String(raw) : raw
  const n   = Number(parseCOP(str))
  return str === '' || isNaN(n) ? '' : n.toLocaleString('es-CO')
}

export function cop(n: string | number) {
  return Number(n).toLocaleString('es-CO')
}

// ── Operator helpers ──────────────────────────────────────────────────────────
export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export function escapeHtml(s: string | undefined | null) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function getWeekStart(offset: number): Date {
  return addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), offset)
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const OP_COLORS = [
  { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  { bg: 'bg-green-500/20',  text: 'text-green-400'  },
  { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  { bg: 'bg-pink-500/20',   text: 'text-pink-400'   },
  { bg: 'bg-cyan-500/20',   text: 'text-cyan-400'   },
]

export const PATIO_STATUS_LABEL: Record<string, string> = {
  esperando:  'Esperando',
  en_proceso: 'En proceso',
  listo:      'Listo',
  entregado:  'Entregado',
}

export const OP_TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  detallado: { label: 'Detallado',  cls: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  pintura:   { label: 'Pintura',    cls: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  latoneria: { label: 'Latonería',  cls: 'text-blue-400   border-blue-500/30   bg-blue-500/10'   },
}
