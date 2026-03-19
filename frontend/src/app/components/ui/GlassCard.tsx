import { motion } from 'framer-motion'
import { cn } from './cn'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: boolean
}

export function GlassCard({
  children,
  className,
  hover = false,
  onClick,
  padding = true,
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={
        hover
          ? { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(234,179,8,0.12)' }
          : undefined
      }
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-white/8 bg-white/[0.03]',
        padding && 'p-5',
        hover && 'cursor-pointer',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
