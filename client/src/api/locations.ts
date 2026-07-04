import type {
  CreateLocationInput,
  Location,
  PlaceSearchResponse,
  ResolveLocationResponse,
} from '../types'
import { distanceMeters, MATCH_RADIUS_METERS } from '../lib/geo'

export async function fetchLocations(): Promise<Location[]> {
  const response = await fetch('/api/locations')
  if (!response.ok) {
    throw new Error('Failed to load locations.')
  }
  return response.json()
}

export async function searchPlaces(query: string): Promise<PlaceSearchResponse> {
  const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}&limit=6`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to search places.')
  }
  return response.json()
}

export async function resolveLocationAt(
  lat: number,
  lng: number,
): Promise<ResolveLocationResponse> {
  const response = await fetch('/api/locations/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to resolve location.')
  }

  return response.json()
}

/** Offline fallback — match against locally cached locations only */
export function resolveLocationLocally(
  lat: number,
  lng: number,
  localLocations: Location[],
): ResolveLocationResponse {
  const tap = { lat, lng }
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
  const response = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error ?? 'Failed to create location.')
  }

  return body.location
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
