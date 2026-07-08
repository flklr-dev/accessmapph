import type {
  CreateLocationInput,
  Location,
  PlaceSearchResponse,
  ResolveLocationResponse,
} from '../types'
import { distanceMeters, isWithinPhilippinesBounds, MATCH_RADIUS_METERS } from '../lib/geo'
import { apiFetch } from './http'

export async function fetchLocations(): Promise<Location[]> {
  return apiFetch<Location[]>('/api/locations', { auth: false })
}

export async function searchPlaces(query: string): Promise<PlaceSearchResponse> {
  return apiFetch<PlaceSearchResponse>(
    `/api/locations/search?q=${encodeURIComponent(query)}&limit=6`,
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
  return data.location
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
