import { useEffect } from 'react'
import { fetchLocations } from '../api/locations'
import { useMapStore } from '../store/mapStore'

/** Load locations from the API on mount (falls back to seed data already in store). */
export function useLocations() {
  const setLocations = useMapStore((s) => s.setLocations)

  useEffect(() => {
    let cancelled = false

    fetchLocations()
      .then((locations) => {
        if (!cancelled && locations.length > 0) {
          setLocations(locations)
        }
      })
      .catch(() => {
        // Keep seed data as offline fallback
      })

    return () => {
      cancelled = true
    }
  }, [setLocations])
}
