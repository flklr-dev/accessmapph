import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-text-muted m-0">
          {hint}
        </p>
      )}
      <div data-describedby={describedBy}>{children}</div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-500 m-0">
          {error}
        </p>
      )}
    </div>
  )
}
