import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/5 text-gray-300 ring-white/10',
        yellow:  'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20',
        green:   'bg-green-500/15 text-green-400 ring-green-500/20',
        red:     'bg-red-500/15 text-red-400 ring-red-500/20',
        blue:    'bg-blue-500/15 text-blue-400 ring-blue-500/20',
        orange:  'bg-orange-500/15 text-orange-400 ring-orange-500/20',
        purple:  'bg-purple-500/15 text-purple-400 ring-purple-500/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  )
}
