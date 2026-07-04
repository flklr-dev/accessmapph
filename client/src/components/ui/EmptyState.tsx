import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 text-text-faint" aria-hidden="true">
        {icon ?? <MapPin size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="text-base font-semibold text-text m-0 mb-1">{title}</h3>
      <p className="text-sm text-text-muted m-0 max-w-xs leading-relaxed">{description}</p>
    </div>
  )
}
