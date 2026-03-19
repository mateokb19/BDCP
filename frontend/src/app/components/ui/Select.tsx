import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from './cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
  className?: string
  disabled?: boolean
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Seleccionar...',
  label,
  className,
  disabled,
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-300">{label}</label>}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={cn(
            'flex items-center justify-between w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100',
            'focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20',
            'transition-colors duration-200 data-[placeholder]:text-gray-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown size={16} className="text-gray-400" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-[100] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/10 bg-gray-900 shadow-2xl"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map(opt => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-200 cursor-pointer outline-none hover:bg-white/8 data-[highlighted]:bg-white/8 data-[state=checked]:text-yellow-400 transition-colors"
                >
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check size={14} className="text-yellow-400" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  )
}
