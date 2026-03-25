import { Car, Truck, Bike } from 'lucide-react'
import type { VehicleType } from '@/types'

interface VehicleTypeIconProps {
  type: VehicleType
  size?: number
  className?: string
}

export function VehicleTypeIcon({ type, size = 20, className }: VehicleTypeIconProps) {
  if (type === 'automovil') return <Car  size={size} className={className} />
  if (type === 'moto')      return <Bike size={size} className={className} />
  return <Truck size={size} className={className} />
}

export function vehicleTypeLabel(type: VehicleType): string {
  if (type === 'automovil')       return 'Automóvil'
  if (type === 'camion_estandar') return 'Camioneta Estándar'
  if (type === 'camion_xl')       return 'Camioneta XL'
  return 'Moto'
}
