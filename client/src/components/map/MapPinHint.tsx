import { MapPin } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

/** Subtle map affordance — sits near the map canvas, not stacked under search. */
export function MapPinHint() {
  const mapTap = useMapStore((s) => s.mapTap)

  if (mapTap) return null

  return (
    <div
      className="absolute bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-map pointer-events-none select-none"
      aria-hidden="true"
    >
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-ink-muted [text-shadow:0_0_8px_rgba(250,250,248,0.95),0_1px_2px_rgba(250,250,248,0.8)]">
        <MapPin size={12} className="opacity-70 shrink-0" strokeWidth={2.25} />
        Tap the map to pin a spot
      </span>
    </div>
  )
}
