export const MATCH_RADIUS_METERS = 75
export const MIN_SEPARATION_METERS = 15

const EARTH_RADIUS_M = 6_371_000

/**
 * Cheap client-side pre-filter so we don't even round-trip to the server for
 * obviously out-of-country taps (e.g. clicking the other side of the map).
 * This is generous by design — it also covers some neighboring waters — the
 * server does the authoritative check (bounding box + reverse-geocode
 * country + ocean detection) in `server/src/lib/nominatim.ts`. Keep this box
 * in sync with the server copy in `server/src/lib/geo.ts`.
 */
export const PH_BOUNDS = {
  minLat: 4.5,
  maxLat: 21.5,
  minLng: 116.0,
  maxLng: 127.0,
}

/**
 * Tighter framing box for the map's country-wide overview — hugs the
 * archipelago (Batanes to Tawi-Tawi, Palawan to Davao Oriental) so
 * `fitBounds`/`flyToBounds` zooms out just enough to show the whole
 * country without cropping, regardless of viewport aspect ratio.
 */
export const PH_MAP_BOUNDS: [[number, number], [number, number]] = [
  [4.3, 116.3],
  [21.3, 127.2],
]

export function isWithinPhilippinesBounds(lat: number, lng: number): boolean {
  return (
    lat >= PH_BOUNDS.minLat &&
    lat <= PH_BOUNDS.maxLat &&
    lng >= PH_BOUNDS.minLng &&
    lng <= PH_BOUNDS.maxLng
  )
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
