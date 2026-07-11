import { Search } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

export function MapSearchBar() {
  const setFindPlaceModalOpen = useMapStore((s) => s.setFindPlaceModalOpen)
  const mapTap = useMapStore((s) => s.mapTap)

  if (mapTap) return null

  return (
    <button
      type="button"
      onClick={() => setFindPlaceModalOpen(true)}
      className="absolute top-3 left-14 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[calc(100%-1.5rem)] sm:max-w-md z-map flex items-center gap-2 px-3 py-2 min-h-11 glass-panel-interactive rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
      aria-label="Search a place to report accessibility. You can also tap the map to pin a spot."
    >
      <Search size={15} className="text-ink-muted shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="flex-1 min-w-0 text-left text-sm truncate">
        <span className="text-ink-muted">Search a place to report</span>
        <span className="text-ink-muted/55"> · tap map to pin</span>
      </span>
      <kbd className="hidden sm:inline-block shrink-0 text-[10px] font-medium text-ink-muted/70 bg-black/5 border border-black/10 px-1.5 py-0.5 rounded-sm">
        ⌘K
      </kbd>
    </button>
  )
}
