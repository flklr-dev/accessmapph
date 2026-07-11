import { useEffect, useState } from 'react'
import { fetchLocationById } from '../api/locations'
import { useMapStore } from '../store/mapStore'

/**
 * When a pin is selected and its reports are still slim (from the map list),
 * hydrate full report payloads (photos, authors, descriptions) from GET /:id.
 */
export function useLocationDetail(locationId: string | null) {
  const location = useMapStore((s) =>
    locationId ? s.locations.find((l) => l.id === locationId) : undefined,
  )
  const upsertLocation = useMapStore((s) => s.upsertLocation)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsHydration =
    Boolean(locationId) &&
    Boolean(location) &&
    location?.reportsLoaded !== true

  useEffect(() => {
    if (!locationId || !needsHydration) {
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchLocationById(locationId)
      .then((detail) => {
        if (cancelled) return
        upsertLocation({ ...detail, reportsLoaded: true })
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load report details.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locationId, needsHydration, upsertLocation])

  return {
    location,
    loading: needsHydration && loading,
    error,
  }
}
