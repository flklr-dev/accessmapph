import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, Globe, Plus } from 'lucide-react'
import { searchPlaces } from '../../api/locations'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import type { Location, PlaceSearchResult } from '../../types'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/utils'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * The single, unified "search AccessMap PH" surface — reachable from the map's
 * search bar or the global ⌘K / "/" shortcut. One search, one mental model:
 * results are grouped by what happens when you pick them (view vs. report),
 * not by which UI you opened it from.
 */
export function FindPlaceModal() {
  const isOpen = useMapStore((s) => s.isFindPlaceModalOpen)
  const setOpen = useMapStore((s) => s.setFindPlaceModalOpen)
  const locations = useMapStore((s) => s.locations)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const openReportModal = useMapStore((s) => s.openReportModal)
  const startReportFromSearch = useMapStore((s) => s.startReportFromSearch)
  const requireAuth = useAuthStore((s) => s.requireAuth)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTypingElsewhere =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      const isTrigger =
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') ||
        (e.key === '/' && !isTypingElsewhere)

      if (isTrigger) {
        e.preventDefault()
        setOpen(!isOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setOpen])

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onMapResults, setOnMapResults] = useState<Location[]>([])
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQuery = useDebouncedValue(query, 350)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setError(null)
      setOnMapResults([])
      setPlaceResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const trimmed = debouncedQuery.trim()
    if (trimmed.length < 2) {
      setOnMapResults([])
      setPlaceResults([])
      setLoading(false)
      return
    }

    const localMatches = locations
      .filter(
        (loc) =>
          loc.name.toLowerCase().includes(trimmed.toLowerCase()) ||
          loc.address.toLowerCase().includes(trimmed.toLowerCase()) ||
          loc.city.toLowerCase().includes(trimmed.toLowerCase()),
      )
      .slice(0, 6)

    // Show seeded/on-map hits immediately — don't wait for Render + Nominatim.
    setOnMapResults(localMatches)
    setLoading(true)
    setError(null)

    let cancelled = false

    searchPlaces(trimmed)
      .then(({ onMap, places, geocoderUnavailable }) => {
        if (cancelled) return
        const mergedOnMap = onMap.length > 0 ? onMap : localMatches
        setOnMapResults(mergedOnMap)
        setPlaceResults(places)
        if (geocoderUnavailable && places.length === 0 && mergedOnMap.length === 0) {
          setError('Place search is slow right now — try again in a moment.')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setOnMapResults(localMatches)
        setPlaceResults([])
        setError(err instanceof Error ? err.message : 'Search failed.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isOpen, locations])

  const handleClose = () => setOpen(false)

  const hasResults = onMapResults.length > 0 || placeResults.length > 0
  const showEmpty = debouncedQuery.trim().length >= 2 && !loading && !hasResults && !error

  return (
    <Modal open={isOpen} onClose={handleClose} title="Search AccessMap PH">
      <p className="text-sm text-text-muted m-0 mb-4">
        Find a place already on the map to view its reports, or search any place to add a new
        accessibility report.
      </p>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. SM Mall of Asia, Ayala Center Cebu…"
          className="w-full pl-9 pr-3 py-2.5 text-base text-text bg-white border border-border rounded-md transition-colors hover:border-gray-400 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--color-blue-50)]"
          aria-label="Search for a place"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-text-muted py-3" role="status">
          <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
          Searching places…
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-500 m-0 mb-3" role="alert">
          {error}
        </p>
      )}

      {showEmpty && (
        <p className="text-sm text-text-muted m-0 py-4 text-center">
          No places found. Try a different name or tap the map to pick a spot.
        </p>
      )}

      {!loading && onMapResults.length > 0 && (
        <section className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0 mb-2">
            Already on the map
          </h3>
          <ul className="m-0 p-0 list-none space-y-1" role="list">
            {onMapResults.map((loc) => (
              <li key={loc.id}>
                <div
                  className={cn(
                    'flex items-center gap-2 p-1 rounded-md border border-border bg-white',
                    'hover:border-primary hover:bg-blue-50/50 transition-colors',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocation(loc.id)
                      setOpen(false)
                    }}
                    className="flex-1 min-w-0 text-left p-2 border-0 bg-transparent cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-text">
                      <MapPin size={14} className="text-primary shrink-0" aria-hidden="true" />
                      <span className="truncate">{loc.name}</span>
                    </span>
                    <span className="block text-xs text-text-muted mt-0.5 pl-6 truncate">
                      {loc.address} · {loc.city}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      requireAuth(() => {
                        openReportModal(loc.id)
                        setOpen(false)
                      }, 'Sign in to report at this location.')
                    }
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 mr-1 rounded-sm text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border-0 cursor-pointer transition-colors"
                  >
                    <Plus size={13} aria-hidden="true" />
                    Report
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && placeResults.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0 mb-2">
            Not yet on the map
          </h3>
          <ul className="m-0 p-0 list-none space-y-1" role="list">
            {placeResults.map((place, index) => (
              <li key={`${place.placeKey ?? place.name}-${index}`}>
                <button
                  type="button"
                  onClick={() =>
                    requireAuth(
                      () => startReportFromSearch(place),
                      'Sign in to add and report this place.',
                    )
                  }
                  className={cn(
                    'w-full text-left p-3 rounded-md border border-border bg-white',
                    'hover:border-primary hover:bg-blue-50/50 cursor-pointer transition-colors',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-text">
                    <Globe size={14} className="text-text-muted shrink-0" aria-hidden="true" />
                    {place.name}
                  </span>
                  <span className="block text-xs text-text-muted mt-0.5 pl-6">
                    {place.address} · {place.city}
                  </span>
                  <span className="block text-[11px] text-primary mt-1 pl-6 font-medium">
                    Add & report →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {debouncedQuery.trim().length < 2 && !loading && (
        <p className="text-xs text-text-faint m-0 pt-2 text-center">
          Type at least 2 characters to search
        </p>
      )}
    </Modal>
  )
}
