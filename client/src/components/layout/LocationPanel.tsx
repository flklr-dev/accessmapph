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
import { useAuthStore } from '../../store/authStore'
import { useFilteredLocations, useLocationStatus } from '../../hooks/useFilteredLocations'
import { useLocationDetail } from '../../hooks/useLocationDetail'
import type { AccessibilityStatus, Location, LocationCategory } from '../../types'
import { FEATURE_LABELS } from '../../types'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ReportVoteBar } from '../reports/ReportVoteBar'

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
        const isSelected = location.id === selectedId
        const { label: categoryLabel, Icon: CategoryIcon } = categoryConfig[location.category]

        return (
          <li key={location.id}>
            <button
              type="button"
              onClick={() => onSelect(location.id)}
              className={`w-full text-left px-4 py-3 border-0 border-b border-border cursor-pointer transition-colors ${
                isSelected ? 'bg-primary/5' : 'bg-transparent hover:bg-surface-1'
              }`}
            >
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-md bg-primary/10 text-primary mt-0.5">
                  <CategoryIcon size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-ink leading-snug truncate">
                      {location.name}
                    </span>
                    <div className="shrink-0">
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
  const { loading, error } = useLocationDetail(location.id)
  const getLocationStatus = useLocationStatus()
  const openReportModal = useMapStore((s) => s.openReportModal)
  const requireAuth = useAuthStore((s) => s.requireAuth)
  // Re-read from store so hydration updates the panel without remounting.
  const hydrated = useMapStore(
    (s) => s.locations.find((l) => l.id === location.id) ?? location,
  )
  const status = getLocationStatus(hydrated)
  const { label: categoryLabel, Icon: CategoryIcon } = categoryConfig[hydrated.category]
  const showReportBodies = hydrated.reportsLoaded === true

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
            {hydrated.name}
          </h2>
          <p className="text-xs text-ink-muted m-0 leading-relaxed">{hydrated.address}</p>
          <p className="text-[11px] text-gray-400 m-0 mt-1">
            {categoryLabel} · {hydrated.city}
          </p>
        </div>
      </div>

      <div className="mb-5 shrink-0">
        <StatusBadge status={status} className="mb-1" />
      </div>

      <Button
        variant="primary"
        className="w-full mb-6 py-2.5 shrink-0"
        onClick={() =>
          requireAuth(
            () => openReportModal(hydrated.id),
            'Sign in to report accessibility.',
          )
        }
      >
        <Plus size={16} aria-hidden="true" />
        Report Accessibility
      </Button>

      <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted m-0 mb-3 shrink-0">
        Community Reports
      </h3>

      <div className="flex-1 min-h-0">
        {error && !showReportBodies ? (
          <EmptyState title="Couldn’t load reports" description={error} />
        ) : hydrated.reports.length === 0 && !loading ? (
          <EmptyState
            title="No reports yet"
            description="Be the first to report accessibility conditions at this location."
          />
        ) : hydrated.reports.length === 0 && loading ? (
          <p className="text-xs text-ink-muted m-0 py-6 text-center" role="status">
            Loading reports…
          </p>
        ) : (
          <ul className="space-y-3 m-0 p-0 list-none pb-6" role="list">
            {loading && (
              <li className="text-xs text-ink-muted text-center py-1" role="status">
                Loading report details…
              </li>
            )}
            {hydrated.reports.map((report) => (
              <li
                key={report.id}
                className="border border-border rounded-md p-4 bg-white shadow-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full border border-border overflow-hidden shrink-0 bg-surface-1 flex items-center justify-center">
                    {showReportBodies && report.authorPhotoURL ? (
                      <img
                        src={report.authorPhotoURL}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-primary">
                        {(report.authorName || 'C').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-ink-muted truncate">
                    {showReportBodies
                      ? report.authorName || 'Contributor'
                      : 'Contributor'}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                    {report.createdAt ? formatDate(report.createdAt) : ''}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-ink">
                    {FEATURE_LABELS[report.featureType]}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {report.aiVerdict === 'flagged' && (
                      <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider rounded-sm bg-red-50 text-red-500">
                        Flagged
                      </span>
                    )}
                    <StatusBadge status={report.status} verified={report.verified} />
                  </div>
                </div>
                {showReportBodies && report.description && (
                  <p className="text-xs text-ink-muted m-0 mb-2 leading-relaxed">
                    {report.description}
                  </p>
                )}
                {showReportBodies && report.photos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {report.photos.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-14 h-14 rounded-sm overflow-hidden border border-border shrink-0"
                      >
                        <img
                          src={url}
                          alt="Reported condition"
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {showReportBodies && (
                  <ReportVoteBar locationId={hydrated.id} report={report} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
