export interface ReverseGeocodeResult {
  name: string
  address: string
  city: string
  placeKey: string | null
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
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'AccessMapPH/0.1 (accessibility mapping; dev@accessmapph.local)',
  Accept: 'application/json',
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
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('zoom', '18')

  try {
    const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
    if (!response.ok) return null

    const data = (await response.json()) as NominatimResponse
    const city = extractCity(data.address ?? {})
    const address = formatAddress(data, city) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const name = data.name ?? data.address?.road ?? data.address?.suburb ?? `Location near ${city}`

    return { name, address, city, placeKey: buildPlaceKey(data) }
  } catch {
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
