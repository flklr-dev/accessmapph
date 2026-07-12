import type {
  CreateLocationInput,
  FetchLocationsOptions,
  Location,
  PlaceSearchResult,
  PlaceSearchResponse,
  ResolveLocationResponse,
} from '../types'
import { distanceMeters, isWithinPhilippinesBounds, MATCH_RADIUS_METERS } from '../lib/geo'
import { apiFetch } from './http'

/** Slim map pins — enough for markers + filters. Full reports via fetchLocationById. */
export async function fetchLocations(
  options: FetchLocationsOptions = {},
): Promise<Location[]> {
  const params = new URLSearchParams()
  if (options.city && options.city !== 'all') {
    params.set('city', options.city)
  }
  if (options.bbox) {
    params.set('bbox', options.bbox)
  }
  if (options.limit) {
    params.set('limit', String(options.limit))
  }
  const qs = params.toString()
  return apiFetch<Location[]>(`/api/locations${qs ? `?${qs}` : ''}`, { auth: false })
}

/** Full location detail including photos, authors, and descriptions. */
export async function fetchLocationById(id: string): Promise<Location> {
  return apiFetch<Location>(`/api/locations/${encodeURIComponent(id)}`, { auth: false })
}

const SEARCH_LIMIT = 6

function searchQueryParams(query: string): string {
  return `q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`
}

/** Fast map-pin search — returns as soon as MongoDB responds. */
export async function searchOnMap(
  query: string,
  signal?: AbortSignal,
): Promise<Location[]> {
  const data = await apiFetch<{ onMap: Location[] }>(
    `/api/locations/search/on-map?${searchQueryParams(query)}`,
    { auth: false, signal },
  )
  return data.onMap
}

/** External place search — OpenStreetMap (may take a few seconds). */
export async function searchExternalPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<{ places: PlaceSearchResult[]; geocoderUnavailable?: boolean }> {
  return apiFetch<{ places: PlaceSearchResult[]; geocoderUnavailable?: boolean }>(
    `/api/locations/search/places?${searchQueryParams(query)}`,
    { auth: false, signal },
  )
}

/** @deprecated Prefer searchOnMap + searchExternalPlaces for progressive loading. */
export async function searchPlaces(query: string): Promise<PlaceSearchResponse> {
  return apiFetch<PlaceSearchResponse>(
    `/api/locations/search?${searchQueryParams(query)}`,
    { auth: false },
  )
}

export async function resolveLocationAt(
  lat: number,
  lng: number,
): Promise<ResolveLocationResponse> {
  return apiFetch<ResolveLocationResponse>('/api/locations/resolve', {
    method: 'POST',
    body: { lat, lng },
    auth: false,
  })
}

/** Offline fallback — match against locally cached locations only */
export function resolveLocationLocally(
  lat: number,
  lng: number,
  localLocations: Location[],
): ResolveLocationResponse {
  const tap = { lat, lng }

  // Offline fallback can't reverse-geocode, so it can only catch the
  // obviously-outside-PH case (not open ocean within the bounding box).
  if (!isWithinPhilippinesBounds(lat, lng)) {
    return {
      action: 'invalid',
      tap,
      reason: 'outside_ph',
      message: 'This spot is outside the Philippines. AccessMap PH only covers locations within the country.',
    }
  }

  const nearby = localLocations
    .map((location) => ({
      location,
      distanceMeters: distanceMeters(tap, location),
      matchReason:
        distanceMeters(tap, location) <= 25
          ? ('strong_proximity' as const)
          : ('proximity' as const),
    }))
    .filter((c) => c.distanceMeters <= MATCH_RADIUS_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)

  if (nearby.length === 1) {
    return {
      action: 'matched',
      tap,
      location: nearby[0].location,
      distanceMeters: nearby[0].distanceMeters,
      matchReason: nearby[0].matchReason,
    }
  }

  if (nearby.length > 1) {
    return { action: 'nearby', tap, candidates: nearby }
  }

  return {
    action: 'new',
    tap,
    suggestion: {
      name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: 'Unknown',
      placeKey: null,
    },
  }
}

export async function createLocation(
  input: CreateLocationInput,
): Promise<Location> {
  const data = await apiFetch<{ location: Location }>('/api/locations', {
    method: 'POST',
    body: input,
    auth: true,
  })
  return { ...data.location, reportsLoaded: true }
}

export async function resolveLocationWithFallback(
  lat: number,
  lng: number,
  localLocations: Location[],
): Promise<ResolveLocationResponse> {
  try {
    return await resolveLocationAt(lat, lng)
  } catch {
    return resolveLocationLocally(lat, lng, localLocations)
  }
}
