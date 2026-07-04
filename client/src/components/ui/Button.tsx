import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white border-primary hover:bg-primary-hover hover:border-primary-hover',
  secondary:
    'bg-white text-text border-border hover:bg-gray-50 hover:border-gray-400',
  destructive:
    'bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600',
  ghost:
    'bg-transparent text-text-muted border-transparent hover:bg-gray-100 hover:text-text',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold leading-none',
        'rounded-md border transition-colors duration-150 whitespace-nowrap',
        'min-h-11 min-w-11 cursor-pointer',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
