import {
  ArrowLeft,
  Building2,
  GraduationCap,
  HeartPulse,
  Landmark,
  MapPin,
  Plus,
  ShoppingBag,
  Train,
  X,
} from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useFilteredLocations, useLocationStatus } from '../../hooks/useFilteredLocations'
import type { AccessibilityStatus, Location, LocationCategory } from '../../types'
import { FEATURE_LABELS } from '../../types'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

const categoryConfig: Record<
  LocationCategory,
  { label: string; Icon: typeof MapPin }
> = {
  mall: { label: 'Mall', Icon: ShoppingBag },
  school: { label: 'School', Icon: GraduationCap },
  government: { label: 'Government', Icon: Landmark },
  hospital: { label: 'Hospital', Icon: HeartPulse },
  transport: { label: 'Transport', Icon: Train },
  other: { label: 'Other', Icon: Building2 },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface LocationPanelProps {
  showHeader?: boolean
}

export function LocationPanel({ showHeader = true }: LocationPanelProps) {
  const filteredLocations = useFilteredLocations()
  const selectedLocationId = useMapStore((s) => s.selectedLocationId)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const getLocationStatus = useLocationStatus()
  const searchQuery = useMapStore((s) => s.searchQuery)

  const selectedLocation = filteredLocations.find((l) => l.id === selectedLocationId)

  return (
    <div className="flex flex-col h-full w-full bg-canvas overflow-hidden">
      {showHeader && !selectedLocation && (
        <div className="px-4 py-3 border-b border-border bg-surface-1 shrink-0">
          <h2 className="text-sm font-semibold text-ink m-0">
            {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
          </h2>
          {searchQuery && (
            <p className="text-xs text-[#6B6B6B] m-0 mt-0.5">
              Results for "{searchQuery}"
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {selectedLocation ? (
          <LocationDetail
            location={selectedLocation}
            onBack={() => setSelectedLocation(null)}
          />
        ) : (
          <LocationList
            locations={filteredLocations}
            selectedId={selectedLocationId}
            onSelect={setSelectedLocation}
            getStatus={getLocationStatus}
            hasSearch={!!searchQuery.trim()}
          />
        )}
      </div>
    </div>
  )
}

function LocationList({
  locations,
  selectedId,
  onSelect,
  getStatus,
  hasSearch,
}: {
  locations: Location[]
  selectedId: string | null
  onSelect: (id: string) => void
  getStatus: (location: Location) => AccessibilityStatus
  hasSearch: boolean
}) {
  if (locations.length === 0) {
    return (
      <EmptyState
        title={hasSearch ? 'No results found' : 'No locations match'}
        description={
          hasSearch
            ? 'Try a different search term or clear your filters.'
            : 'Adjust your filters to see more locations on the map.'
        }
      />
    )
  }

  return (
    <ul className="m-0 p-0 list-none" role="list">
      {locations.map((location) => {
        const status = getStatus(location)
        const isSelected = selectedId === location.id
        const { label: categoryLabel, Icon: CategoryIcon } =
          categoryConfig[location.category]

        return (
          <li key={location.id}>
            <button
              type="button"
              onClick={() => onSelect(location.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={`w-full text-left px-4 py-4 border-0 border-b border-border bg-transparent cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] ${
                isSelected ? 'bg-[#8E5FEB]/8 text-ink' : 'hover:bg-surface-1'
              }`}
            >
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-md bg-surface-1 text-ink-muted">
                  <CategoryIcon size={18} aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-ink m-0 truncate">
                      {location.name}
                    </h3>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {location.source === 'community' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Community
                        </span>
                      )}
                      <StatusBadge status={status} />
                    </div>
                  </div>

                  <p className="text-xs text-ink-muted m-0 mb-1.5 line-clamp-2 leading-relaxed">
                    {location.address}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{location.city}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {location.reports.length} report
                      {location.reports.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function LocationDetail({
  location,
  onBack,
}: {
  location: Location
  onBack: () => void
}) {
  const getLocationStatus = useLocationStatus()
  const openReportModal = useMapStore((s) => s.openReportModal)
  const status = getLocationStatus(location)
  const { label: categoryLabel, Icon: CategoryIcon } = categoryConfig[location.category]

  return (
    <div className="p-4 md:p-6 bg-canvas min-h-full flex flex-col">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-transparent border-0 cursor-pointer p-0 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to list
        </button>

        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded-sm text-ink-muted hover:text-ink hover:bg-surface-1 cursor-pointer border-0 bg-transparent flex items-center justify-center"
          aria-label="Close detail panel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex gap-4 mb-5 shrink-0">
        <div className="flex items-center justify-center w-12 h-12 shrink-0 rounded-lg bg-primary/10 text-primary">
          <CategoryIcon size={22} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-display font-extrabold text-ink m-0 mb-1 leading-snug break-words">
            {location.name}
          </h2>
          <p className="text-xs text-ink-muted m-0 leading-relaxed">{location.address}</p>
          <p className="text-[11px] text-gray-400 m-0 mt-1">
            {categoryLabel} · {location.city}
          </p>
        </div>
      </div>

      <div className="mb-5 shrink-0">
        <StatusBadge status={status} className="mb-1" />
      </div>

      <Button
        variant="primary"
        className="w-full mb-6 py-2.5 shrink-0"
        onClick={() => openReportModal(location.id)}
      >
        <Plus size={16} aria-hidden="true" />
        Report Accessibility
      </Button>

      <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted m-0 mb-3 shrink-0">
        Community Reports
      </h3>

      <div className="flex-1 min-h-0">
        {location.reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            description="Be the first to report accessibility conditions at this location."
          />
        ) : (
          <ul className="space-y-3 m-0 p-0 list-none pb-6" role="list">
            {location.reports.map((report) => (
              <li
                key={report.id}
                className="border border-border rounded-md p-4 bg-white shadow-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-ink">
                    {FEATURE_LABELS[report.featureType]}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {report.aiVerdict === 'flagged' && (
                      <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider rounded-sm bg-yellow-50 text-yellow-600">
                        Under review
                      </span>
                    )}
                    <StatusBadge status={report.status} verified={report.verified} />
                  </div>
                </div>
                {report.description && (
                  <p className="text-xs text-ink-muted m-0 mb-2 leading-relaxed">
                    {report.description}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 m-0">
                  Updated {formatDate(report.createdAt)}
                  {report.upvotes > 0 && ` · ${report.upvotes} confirmations`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
