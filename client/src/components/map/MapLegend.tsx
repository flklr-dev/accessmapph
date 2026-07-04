import { STATUS_LABELS, type AccessibilityStatus } from '../../types'

const legendItems: AccessibilityStatus[] = [
  'accessible',
  'partial',
  'inaccessible',
  'unverified',
]

const dotClass: Record<AccessibilityStatus, string> = {
  accessible: 'bg-green-500',
  partial: 'bg-yellow-500',
  inaccessible: 'bg-red-500',
  unverified: 'bg-gray-400',
}

export function MapLegend() {
  return (
    <div
      className="absolute bottom-6 left-6 z-map bg-canvas/90 backdrop-blur-xs border border-border rounded-md px-4 py-3 shadow-card hidden sm:block"
      aria-label="Map legend"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0 mb-2">
        Status
      </p>
      <ul className="space-y-1.5 m-0 p-0 list-none">
        {legendItems.map((status) => (
          <li key={status} className="flex items-center gap-2 text-sm text-text">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${dotClass[status]}`}
              aria-hidden="true"
            />
            {STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
    </div>
  )
}
