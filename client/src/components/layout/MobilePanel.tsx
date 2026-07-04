import { ChevronUp } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useFilteredLocations } from '../../hooks/useFilteredLocations'
import { FilterBar } from './FilterBar'
import { LocationPanel } from './LocationPanel'
import { cn } from '../../lib/utils'

export function MobilePanel() {
  const isOpen = useMapStore((s) => s.isMobilePanelOpen)
  const setMobilePanelOpen = useMapStore((s) => s.setMobilePanelOpen)
  const selectedLocationId = useMapStore((s) => s.selectedLocationId)
  const showMobileFilters = useMapStore((s) => s.showMobileFilters)
  const setShowMobileFilters = useMapStore((s) => s.setShowMobileFilters)

  const filteredLocations = useFilteredLocations()

  const panelTitle = selectedLocationId
    ? 'Location details'
    : `${filteredLocations.length} location${filteredLocations.length !== 1 ? 's' : ''}`

  return (
    <>
      {showMobileFilters && (
        <div className="md:hidden fixed inset-0 z-dropdown">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 border-0 cursor-pointer"
            aria-label="Close filters"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute top-14 left-0 right-0 bg-white shadow-md max-h-[70vh] overflow-y-auto">
            <FilterBar onClose={() => setShowMobileFilters(false)} />
          </div>
        </div>
      )}

      <div
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-sticky bg-white border-t border-border shadow-md',
          'flex flex-col transition-transform duration-250 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.25rem)]',
        )}
        style={{ maxHeight: '55vh' }}
      >
        <button
          type="button"
          onClick={() => setMobilePanelOpen(!isOpen)}
          className="flex items-center justify-between px-4 py-3 border-0 border-b border-border bg-white cursor-pointer min-h-[3.25rem] w-full shrink-0"
          aria-expanded={isOpen}
          aria-controls="mobile-location-panel"
        >
          <span className="text-sm font-semibold text-text">{panelTitle}</span>
          <ChevronUp
            size={20}
            className={cn('text-text-muted transition-transform', !isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        <div id="mobile-location-panel" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <LocationPanel showHeader={!selectedLocationId} />
        </div>
      </div>
    </>
  )
}
