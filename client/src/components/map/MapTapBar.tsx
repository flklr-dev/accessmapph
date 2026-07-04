import { MapPin, X } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { Button } from '../ui/Button'

export function MapTapBar() {
  const mapTap = useMapStore((s) => s.mapTap)
  const isPinModalOpen = useMapStore((s) => s.isPinModalOpen)
  const openPinModal = useMapStore((s) => s.openPinModal)
  const clearMapTap = useMapStore((s) => s.clearMapTap)

  if (!mapTap || isPinModalOpen) return null

  return (
    <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[400] w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-3 px-4 py-3 bg-canvas/95 backdrop-blur-xs border border-border rounded-md shadow-elevated">
        <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-md bg-primary/10 text-primary">
          <MapPin size={18} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text m-0">Spot selected</p>
          <p className="text-xs text-text-muted m-0 truncate">
            {mapTap.lat.toFixed(4)}, {mapTap.lng.toFixed(4)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={clearMapTap}
            className="inline-flex items-center justify-center w-11 h-11 rounded-md border border-border bg-white text-text-muted hover:bg-gray-50 hover:text-text cursor-pointer"
            aria-label="Cancel selection"
          >
            <X size={16} aria-hidden="true" />
          </button>
          <Button size="sm" onClick={openPinModal}>
            Report here
          </Button>
        </div>
      </div>
    </div>
  )
}
