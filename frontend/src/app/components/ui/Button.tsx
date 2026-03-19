import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50',
  {
    variants: {
      variant: {
        primary:     'bg-gradient-to-r from-yellow-500 to-yellow-400 text-gray-950 hover:from-yellow-400 hover:to-yellow-300 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 active:scale-[0.98]',
        secondary:   'bg-white/8 text-gray-200 border border-white/10 hover:bg-white/12 hover:border-white/15 active:scale-[0.98]',
        ghost:       'text-gray-300 hover:bg-white/6 hover:text-white active:scale-[0.98]',
        outline:     'border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 active:scale-[0.98]',
        destructive: 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 active:scale-[0.98]',
      },
      size: {
        sm:   'px-3 py-1.5 text-sm',
        md:   'px-4 py-2 text-sm',
        lg:   'px-5 py-2.5 text-base',
        icon: 'p-2',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, isLoading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'
