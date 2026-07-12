import { useEffect } from 'react'
import { fetchLocations } from '../api/locations'
import {
  getCachedLocations,
  loadLocationsForSpace,
  setCachedLocations,
} from '../lib/locationCache'
import { useMapStore } from '../store/mapStore'
import { SEED_LOCATIONS } from '../data/seedLocations'
import type { Location, MapSpace } from '../types'

function seedForSpace(space: MapSpace): Location[] {
  if (space === 'all') return SEED_LOCATIONS
  const pattern =
    space === 'manila' ? /manila/i : space === 'cebu' ? /cebu/i : /davao/i
  return SEED_LOCATIONS.filter((loc) => pattern.test(loc.city))
}

async function fetchSpaceLocations(space: MapSpace): Promise<Location[]> {
  return fetchLocations({ city: space })
}

function devSeedFallback(space: MapSpace): Location[] {
  return import.meta.env.DEV ? seedForSpace(space) : []
}

/**
 * Load slim map pins for the active space.
 * Shows cached pins immediately on space switch, then revalidates in background.
 */
export function useLocations() {
  const setLocations = useMapStore((s) => s.setLocations)
  const activeSpace = useMapStore((s) => s.activeSpace)

  useEffect(() => {
    let cancelled = false

    const cached = getCachedLocations(activeSpace)
    if (cached) {
      setLocations(cached)
    }

    loadLocationsForSpace(activeSpace, () => fetchSpaceLocations(activeSpace))
      .then((locations) => {
        if (cancelled) return
        setCachedLocations(activeSpace, locations)
        setLocations(locations)
      })
      .catch(() => {
        if (!cancelled && !cached) {
          const fallback = devSeedFallback(activeSpace)
          setCachedLocations(activeSpace, fallback)
          setLocations(fallback)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeSpace, setLocations])
}
