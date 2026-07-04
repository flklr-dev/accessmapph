import { cn } from '../../lib/utils'

interface FilterChipProps {
  label: string
  pressed: boolean
  onToggle: () => void
  className?: string
}

export function FilterChip({ label, pressed, onToggle, className }: FilterChipProps) {
  return (
    <button
      type="button"
      role="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 text-sm font-medium',
        'text-text-muted bg-white border border-border rounded-full',
        'cursor-pointer transition-colors duration-150 select-none min-h-11',
        'hover:border-gray-400 hover:text-text',
        'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        pressed && 'bg-blue-50 border-primary text-primary font-semibold',
        className,
      )}
    >
      {label}
    </button>
  )
}
