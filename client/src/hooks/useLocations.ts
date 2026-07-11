import { useEffect } from 'react'
import { fetchLocations } from '../api/locations'
import { useMapStore } from '../store/mapStore'
import { SEED_LOCATIONS } from '../data/seedLocations'
import type { Location, MapSpace } from '../types'

function seedForSpace(space: MapSpace): Location[] {
  if (space === 'all') return SEED_LOCATIONS
  const pattern =
    space === 'manila' ? /manila/i : space === 'cebu' ? /cebu/i : /davao/i
  return SEED_LOCATIONS.filter((loc) => pattern.test(loc.city))
}

/**
 * Load slim map pins for the active space.
 * Full report payloads are fetched on pin select (see useLocationDetail).
 */
export function useLocations() {
  const setLocations = useMapStore((s) => s.setLocations)
  const activeSpace = useMapStore((s) => s.activeSpace)

  useEffect(() => {
    let cancelled = false

    fetchLocations({ city: activeSpace })
      .then((locations) => {
        if (cancelled) return
        // Always replace — empty city scopes should show empty, not stale data.
        setLocations(locations)
      })
      .catch(() => {
        if (!cancelled) {
          setLocations(seedForSpace(activeSpace))
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeSpace, setLocations])
}
