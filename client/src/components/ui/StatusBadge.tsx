import type { AccessibilityStatus } from '../../types'
import { STATUS_LABELS } from '../../types'
import { AlertCircle, CheckCircle, HelpCircle, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

const badgeConfig: Record<
  AccessibilityStatus,
  { className: string; Icon: typeof CheckCircle }
> = {
  accessible: { className: 'bg-green-50 text-green-500', Icon: CheckCircle },
  partial: { className: 'bg-yellow-50 text-yellow-500', Icon: AlertCircle },
  inaccessible: { className: 'bg-red-50 text-red-500', Icon: XCircle },
  unverified: { className: 'bg-gray-100 text-gray-600', Icon: HelpCircle },
}

interface StatusBadgeProps {
  status: AccessibilityStatus
  verified?: boolean
  className?: string
}

export function StatusBadge({ status, verified, className }: StatusBadgeProps) {
  const { className: statusClass, Icon } = badgeConfig[status]

  return (
    <span className={cn('inline-flex items-center gap-1 flex-wrap', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide rounded-sm',
          statusClass,
        )}
      >
        <Icon size={14} aria-hidden="true" />
        {STATUS_LABELS[status]}
      </span>
      {verified && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide rounded-sm bg-blue-50 text-blue-500">
          <CheckCircle size={14} aria-hidden="true" />
          Verified
        </span>
      )}
    </span>
  )
}
