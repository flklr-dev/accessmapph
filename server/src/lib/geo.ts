/** Location dedup constants — keep in sync with docs/locations.md */
export const MATCH_RADIUS_METERS = 75
export const STRONG_MATCH_RADIUS_METERS = 25
export const MIN_SEPARATION_METERS = 15
export const GEOHASH_PRECISION = 7

/**
 * Generous bounding box around the Philippine archipelago (Batanes to
 * Tawi-Tawi, Palawan to Mindanao's east coast). This is a cheap first-pass
 * filter only — it also covers parts of neighboring countries' waters, so it
 * must always be paired with the reverse-geocode country check in
 * `lib/nominatim.ts` before a location is accepted. Keep in sync with the
 * client copy in `client/src/lib/geo.ts`.
 */
export const PH_BOUNDS = {
  minLat: 4.5,
  maxLat: 21.5,
  minLng: 116.0,
  maxLng: 127.0,
}

export function isWithinPhilippinesBounds(lat: number, lng: number): boolean {
  return (
    lat >= PH_BOUNDS.minLat &&
    lat <= PH_BOUNDS.maxLat &&
    lng >= PH_BOUNDS.minLng &&
    lng <= PH_BOUNDS.maxLng
  )
}

const EARTH_RADIUS_M = 6_371_000

export interface GeoPoint {
  lat: number
  lng: number
}

export interface NearbyMatch<T> {
  item: T
  distanceMeters: number
}

/** Haversine distance in meters between two WGS84 coordinates */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
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

export function encodeGeohash(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  let minLat = -90
  let maxLat = 90
  let minLng = -180
  let maxLng = 180
  let hash = ''
  let bit = 0
  let ch = 0
  let isLng = true

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2
      if (lng >= mid) {
        ch = (ch << 1) + 1
        minLng = mid
      } else {
        ch = ch << 1
        maxLng = mid
      }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) {
        ch = (ch << 1) + 1
        minLat = mid
      } else {
        ch = ch << 1
        maxLat = mid
      }
    }

    isLng = !isLng
    bit++

    if (bit === 5) {
      hash += BASE32[ch]
      bit = 0
      ch = 0
    }
  }

  return hash
}

export function findNearby<T extends GeoPoint>(
  point: GeoPoint,
  items: T[],
  radiusMeters: number,
): NearbyMatch<T>[] {
  return items
    .map((item) => ({
      item,
      distanceMeters: distanceMeters(point, item),
    }))
    .filter((m) => m.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
