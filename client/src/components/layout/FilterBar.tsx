import type { FeatureType, DisabilityType } from '../../types'
import { DISABILITY_LABELS, FEATURE_LABELS } from '../../types'
import { useMapStore } from '../../store/mapStore'
import { countActiveFilters } from '../../store/selectors'
import { FilterChip } from '../ui/FilterChip'

const FEATURES: FeatureType[] = [
  'ramp',
  'elevator',
  'restroom',
  'parking',
  'pathway',
  'signage',
]

const DISABILITIES: DisabilityType[] = ['mobility', 'visual', 'hearing', 'cognitive']

interface FilterBarProps {
  className?: string
  onClose?: () => void
}

export function FilterBar({ className = '', onClose }: FilterBarProps) {
  const featureFilters = useMapStore((s) => s.featureFilters)
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)
  const toggleFeatureFilter = useMapStore((s) => s.toggleFeatureFilter)
  const toggleDisabilityFilter = useMapStore((s) => s.toggleDisabilityFilter)
  const clearFilters = useMapStore((s) => s.clearFilters)

  const activeCount = countActiveFilters(featureFilters, disabilityFilters)

  return (
    <div className={`bg-white border-b border-border ${className}`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0">
          Filters
        </p>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-primary bg-transparent border-0 cursor-pointer p-0 hover:underline"
            >
              Clear all ({activeCount})
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden text-xs font-medium text-text-muted bg-transparent border-0 cursor-pointer p-0"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-2">
        <p className="text-xs font-medium text-text-faint mb-2">Features</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Feature filters">
          {FEATURES.map((feature) => (
            <FilterChip
              key={feature}
              label={FEATURE_LABELS[feature]}
              pressed={featureFilters.includes(feature)}
              onToggle={() => toggleFeatureFilter(feature)}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 pb-4">
        <p className="text-xs font-medium text-text-faint mb-2">Disability type</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Disability type filters">
          {DISABILITIES.map((disability) => (
            <FilterChip
              key={disability}
              label={DISABILITY_LABELS[disability]}
              pressed={disabilityFilters.includes(disability)}
              onToggle={() => toggleDisabilityFilter(disability)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
