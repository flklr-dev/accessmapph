import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, Globe } from 'lucide-react'
import { searchPlaces } from '../../api/locations'
import { useMapStore } from '../../store/mapStore'
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

export function FindPlaceModal() {
  const isOpen = useMapStore((s) => s.isFindPlaceModalOpen)
  const setOpen = useMapStore((s) => s.setFindPlaceModalOpen)
  const locations = useMapStore((s) => s.locations)
  const openExistingLocationConfirm = useMapStore((s) => s.openExistingLocationConfirm)
  const startReportFromSearch = useMapStore((s) => s.startReportFromSearch)

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

    setLoading(true)
    setError(null)

    const localMatches = locations
      .filter(
        (loc) =>
          loc.name.toLowerCase().includes(trimmed.toLowerCase()) ||
          loc.address.toLowerCase().includes(trimmed.toLowerCase()) ||
          loc.city.toLowerCase().includes(trimmed.toLowerCase()),
      )
      .slice(0, 6)

    searchPlaces(trimmed)
      .then(({ onMap, places }) => {
        const mergedOnMap = onMap.length > 0 ? onMap : localMatches
        setOnMapResults(mergedOnMap)
        setPlaceResults(places)
      })
      .catch((err) => {
        setOnMapResults(localMatches)
        setPlaceResults([])
        setError(err instanceof Error ? err.message : 'Search failed.')
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery, isOpen, locations])

  const handleClose = () => setOpen(false)

  const hasResults = onMapResults.length > 0 || placeResults.length > 0
  const showEmpty = debouncedQuery.trim().length >= 2 && !loading && !hasResults && !error

  return (
    <Modal open={isOpen} onClose={handleClose} title="Find a place to report">
      <p className="text-sm text-text-muted m-0 mb-4">
        Search by name to find an existing pin or a known place. You&apos;ll confirm the location
        before submitting a report — this helps avoid duplicate or misplaced pins.
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
                <button
                  type="button"
                  onClick={() => openExistingLocationConfirm(loc.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-md border border-border bg-white',
                    'hover:border-primary hover:bg-blue-50/50 cursor-pointer transition-colors',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-text">
                    <MapPin size={14} className="text-primary shrink-0" aria-hidden="true" />
                    {loc.name}
                  </span>
                  <span className="block text-xs text-text-muted mt-0.5 pl-6">
                    {loc.address} · {loc.city}
                  </span>
                  <span className="block text-[11px] text-primary mt-1 pl-6 font-medium">
                    Confirm & report →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && placeResults.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0 mb-2">
            Places from map data
          </h3>
          <ul className="m-0 p-0 list-none space-y-1" role="list">
            {placeResults.map((place, index) => (
              <li key={`${place.placeKey ?? place.name}-${index}`}>
                <button
                  type="button"
                  onClick={() => startReportFromSearch(place)}
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
                    Confirm location & report →
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
