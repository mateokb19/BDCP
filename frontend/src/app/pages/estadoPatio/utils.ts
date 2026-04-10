import type { FacturaRecord } from './types'
import { FACTURA_KEY } from './constants'

const CHECKLIST_KEY = 'bdcpolo_service_checklist'

export function loadFacturas(): Record<number, FacturaRecord> {
  try { return JSON.parse(localStorage.getItem(FACTURA_KEY) ?? '{}') } catch { return {} }
}

export function loadChecklist(): Record<number, number[]> {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '{}') } catch { return {} }
}

export function saveChecklist(data: Record<number, number[]>) {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data))
}

export const parseCOP = (s: string) => s.replace(/\D/g, '')

export const fmtCOP = (raw: string | number): string => {
  const str = typeof raw === 'number' ? String(raw) : raw
  const n   = Number(parseCOP(str))
  return str === '' || isNaN(n) ? '' : n.toLocaleString('es-CO')
}

export const _today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
