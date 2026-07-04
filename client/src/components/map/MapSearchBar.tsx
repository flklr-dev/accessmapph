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
      className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] w-[calc(100%-1.5rem)] max-w-md flex items-center gap-2 px-3 py-2 min-h-11 bg-canvas/95 backdrop-blur-md border border-border rounded-md shadow-card hover:border-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer transition-[border-color,box-shadow] duration-220 ease-[cubic-bezier(0.16,1,0.3,1)]"
      aria-label="Search a place to report accessibility. You can also tap the map to pin a spot."
    >
      <Search size={15} className="text-ink-muted shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="flex-1 min-w-0 text-left text-sm truncate">
        <span className="text-ink-muted">Search a place to report</span>
        <span className="text-ink-muted/55"> · tap map to pin</span>
      </span>
    </button>
  )
}
