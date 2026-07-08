import { isWithinPhilippinesBounds } from './geo.js'

export interface ReverseGeocodeResult {
  name: string
  address: string
  city: string
  placeKey: string | null
  /** ISO 3166-1 alpha-2, lowercase (e.g. "ph"). Null if Nominatim couldn't resolve an address. */
  countryCode: string | null
}

export interface PlaceSearchResult {
  name: string
  address: string
  city: string
  lat: number
  lng: number
  placeKey: string | null
}

interface NominatimAddress {
  road?: string
  suburb?: string
  city?: string
  town?: string
  municipality?: string
  county?: string
  state?: string
  country?: string
  country_code?: string
}

interface NominatimResponse {
  place_id?: number
  osm_type?: string
  osm_id?: number
  display_name?: string
  lat?: string
  lon?: string
  address?: NominatimAddress
  name?: string
  /** Present (with HTTP 200) for open ocean / unresolvable points, e.g. "Unable to geocode". */
  error?: string
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'AccessMapPH/0.1 (accessibility mapping; dev@accessmapph.local)',
  Accept: 'application/json',
}

/** In-memory reverse-geocode cache (rounded coords) — reduces Nominatim abuse. */
const reverseGeocodeCache = new Map<string, ReverseGeocodeResult | null>()
const REVERSE_CACHE_MAX = 2000
const REVERSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const reverseGeocodeCacheTimestamps = new Map<string, number>()

function reverseCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

function getCachedReverse(lat: number, lng: number): ReverseGeocodeResult | null | undefined {
  const key = reverseCacheKey(lat, lng)
  const cachedAt = reverseGeocodeCacheTimestamps.get(key)
  if (cachedAt === undefined) return undefined
  if (Date.now() - cachedAt > REVERSE_CACHE_TTL_MS) {
    reverseGeocodeCache.delete(key)
    reverseGeocodeCacheTimestamps.delete(key)
    return undefined
  }
  return reverseGeocodeCache.get(key) ?? null
}

function setCachedReverse(lat: number, lng: number, value: ReverseGeocodeResult | null): void {
  if (reverseGeocodeCache.size >= REVERSE_CACHE_MAX) {
    const oldestKey = reverseGeocodeCache.keys().next().value
    if (oldestKey) {
      reverseGeocodeCache.delete(oldestKey)
      reverseGeocodeCacheTimestamps.delete(oldestKey)
    }
  }
  const key = reverseCacheKey(lat, lng)
  reverseGeocodeCache.set(key, value)
  reverseGeocodeCacheTimestamps.set(key, Date.now())
}

function extractCity(addr: NominatimAddress): string {
  return addr.city ?? addr.town ?? addr.municipality ?? addr.suburb ?? addr.county ?? 'Unknown'
}

function buildPlaceKey(data: NominatimResponse): string | null {
  if (data.osm_type && data.osm_id) return `osm:${data.osm_type}:${data.osm_id}`
  if (data.place_id) return `nominatim:${data.place_id}`
  return null
}

function formatAddress(data: NominatimResponse, city: string): string {
  const addr = data.address ?? {}
  const street = addr.road ?? ''
  const suburb = addr.suburb ?? ''
  const parts = [street, suburb, city, addr.state, addr.country].filter(Boolean)
  return parts.join(', ') || data.display_name || ''
}

/** Reverse geocode via OpenStreetMap Nominatim (free, rate-limited) */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  const cached = getCachedReverse(lat, lng)
  if (cached !== undefined) return cached

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('zoom', '18')

  try {
    const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!response.ok) {
      setCachedReverse(lat, lng, null)
      return null
    }

    const data = (await response.json()) as NominatimResponse
    // Open ocean / no-data points come back as HTTP 200 with an `error` field
    // and no `address` — treat that the same as "couldn't resolve".
    if (data.error || !data.address) {
      setCachedReverse(lat, lng, null)
      return null
    }

    const city = extractCity(data.address)
    const address = formatAddress(data, city) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const name = data.name ?? data.address?.road ?? data.address?.suburb ?? `Location near ${city}`
    const countryCode = data.address.country_code?.toLowerCase() ?? null

    const result = { name, address, city, placeKey: buildPlaceKey(data), countryCode }
    setCachedReverse(lat, lng, result)
    return result
  } catch {
    setCachedReverse(lat, lng, null)
    return null
  }
}

/** Forward geocode — search places by name (Philippines-biased) */
export async function searchPlaces(
  query: string,
  limit = 6,
): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'ph')
  url.searchParams.set('limit', String(limit))

  try {
    const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!response.ok) return []

    const results = (await response.json()) as NominatimResponse[]
    return results
      .map((item) => {
        const lat = Number(item.lat)
        const lng = Number(item.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

        const city = extractCity(item.address ?? {})
        const address = formatAddress(item, city) || item.display_name || ''
        const name =
          item.name ??
          item.address?.road ??
          item.display_name?.split(',')[0]?.trim() ??
          `Place in ${city}`

        return {
          name,
          address,
          city,
          lat,
          lng,
          placeKey: buildPlaceKey(item),
        }
      })
      .filter((item): item is PlaceSearchResult => item !== null)
  } catch {
    return []
  }
}

export type GeofenceRejectionReason = 'outside_ph' | 'ocean'

export interface GeofenceResult {
  valid: boolean
  reason?: GeofenceRejectionReason
  message?: string
  /** Reverse-geocode data for the point — reuse this instead of geocoding again. */
  geocode?: ReverseGeocodeResult
}

const REJECTION_MESSAGES: Record<GeofenceRejectionReason, string> = {
  outside_ph: 'This spot is outside the Philippines. AccessMap PH only covers locations within the country.',
  ocean: "This looks like open water. Pick a spot on land to add a pin.",
}

/**
 * Authoritative check that a coordinate is on Philippine land — used before a
 * pin can be created or reported on. Two layers, cheapest first:
 *  1. Bounding-box filter (instant, no network call) rejects anything far
 *     outside the archipelago.
 *  2. Reverse geocode via Nominatim confirms the country and rejects points
 *     that resolve to nothing (open ocean / unmapped water).
 */
export async function verifyPhilippineLocation(
  lat: number,
  lng: number,
): Promise<GeofenceResult> {
  if (!isWithinPhilippinesBounds(lat, lng)) {
    return { valid: false, reason: 'outside_ph', message: REJECTION_MESSAGES.outside_ph }
  }

  const geocode = await reverseGeocode(lat, lng)

  if (!geocode) {
    return { valid: false, reason: 'ocean', message: REJECTION_MESSAGES.ocean }
  }

  if (geocode.countryCode && geocode.countryCode !== 'ph') {
    return { valid: false, reason: 'outside_ph', message: REJECTION_MESSAGES.outside_ph }
  }

  return { valid: true, geocode }
}
