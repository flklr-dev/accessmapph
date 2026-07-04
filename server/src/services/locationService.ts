import { Location, type ILocation, type IReport, type LocationCategory } from '../models/Location.js'
import { encodeGeohash, MATCH_RADIUS_METERS, MIN_SEPARATION_METERS, STRONG_MATCH_RADIUS_METERS } from '../lib/geo.js'
import { reverseGeocode } from '../lib/nominatim.js'

export interface LocationCandidate {
  location: ReturnType<typeof toPublicLocation>
  distanceMeters: number
  matchReason: 'place_key' | 'proximity' | 'strong_proximity'
}

export interface LocationSuggestion {
  name: string
  address: string
  city: string
  placeKey: string | null
}

export type ResolveAction = 'matched' | 'nearby' | 'new'

export interface ResolveResult {
  action: ResolveAction
  tap: { lat: number; lng: number }
  location?: ReturnType<typeof toPublicLocation>
  distanceMeters?: number
  matchReason?: LocationCandidate['matchReason']
  candidates?: LocationCandidate[]
  suggestion?: LocationSuggestion
}

export interface CreateLocationInput {
  lat: number
  lng: number
  name: string
  address?: string
  city?: string
  category?: string
  placeKey?: string | null
  forceNew?: boolean
}

function toPublicLocation(doc: ILocation) {
  return doc.toJSON()
}

export async function getAllLocations() {
  const locations = await Location.find().sort({ createdAt: -1 }).lean()
  return locations.map((loc) => {
    const json = {
      id: loc._id.toString(),
      name: loc.name,
      address: loc.address,
      lat: loc.coordinates.coordinates[1],
      lng: loc.coordinates.coordinates[0],
      category: loc.category,
      city: loc.city,
      geohash: loc.geohash,
      placeKey: loc.placeKey,
      source: loc.source,
      reports: loc.reports.map((r) => ({
        id: r._id.toString(),
        locationId: loc._id.toString(),
        featureType: r.featureType,
        status: r.status,
        description: r.description,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        verified: r.verified,
        aiVerdict: r.aiVerdict,
        createdAt: r.createdAt?.toISOString(),
      })),
      createdAt: loc.createdAt?.toISOString(),
    }
    return json
  })
}

export async function searchLocationsByName(query: string, limit = 6) {
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const locations = await Location.find({
    $or: [{ name: regex }, { address: regex }, { city: regex }],
  })
    .limit(limit)
    .sort({ name: 1 })

  return locations.map((loc) => toPublicLocation(loc))
}

export async function getLocationById(id: string) {
  const location = await Location.findById(id)
  return location ? toPublicLocation(location) : null
}

export async function findNearbyLocations(lat: number, lng: number, radiusMeters: number) {
  const locations = await Location.find({
    coordinates: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        $maxDistance: radiusMeters,
      },
    },
  })

  return locations.map((loc) => {
    const locLat = loc.coordinates.coordinates[1]
    const locLng = loc.coordinates.coordinates[0]
    const distanceMeters = haversineDistance(lat, lng, locLat, locLng)
    return { location: loc, distanceMeters }
  })
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export async function findLocationByPlaceKey(placeKey: string) {
  return Location.findOne({ placeKey })
}

export async function resolveLocationAt(lat: number, lng: number): Promise<ResolveResult> {
  const tap = { lat, lng }
  const suggestion = await reverseGeocode(lat, lng)

  if (suggestion?.placeKey) {
    const byKey = await findLocationByPlaceKey(suggestion.placeKey)
    if (byKey) {
      return {
        action: 'matched',
        tap,
        location: toPublicLocation(byKey),
        distanceMeters: 0,
        matchReason: 'place_key',
        suggestion,
      }
    }
  }

  const nearby = await findNearbyLocations(lat, lng, MATCH_RADIUS_METERS)
  const candidates = nearby.map(({ location, distanceMeters }) => ({
    location: toPublicLocation(location),
    distanceMeters,
    matchReason:
      distanceMeters <= STRONG_MATCH_RADIUS_METERS
        ? ('strong_proximity' as const)
        : ('proximity' as const),
  }))

  if (candidates.length === 1) {
    return {
      action: 'matched',
      tap,
      location: candidates[0].location,
      distanceMeters: candidates[0].distanceMeters,
      matchReason: candidates[0].matchReason,
      suggestion: suggestion ?? undefined,
    }
  }

  if (candidates.length > 1) {
    return {
      action: 'nearby',
      tap,
      candidates,
      suggestion: suggestion ?? undefined,
    }
  }

  return {
    action: 'new',
    tap,
    suggestion: suggestion ?? {
      name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: 'Unknown',
      placeKey: null,
    },
  }
}

export async function createLocation(input: CreateLocationInput): Promise<{
  location?: ReturnType<typeof toPublicLocation>
  error?: string
  conflict?: ReturnType<typeof toPublicLocation>
}> {
  const { lat, lng, name, forceNew = false } = input
  const trimmedName = name.trim()

  if (!trimmedName || trimmedName.length < 2) {
    return { error: 'Location name must be at least 2 characters.' }
  }

  if (input.placeKey && !forceNew) {
    const existing = await findLocationByPlaceKey(input.placeKey)
    if (existing) {
      return { error: 'This place already exists on the map.', conflict: toPublicLocation(existing) }
    }
  }

  const tooClose = await findNearbyLocations(lat, lng, MIN_SEPARATION_METERS)

  if (tooClose.length > 0 && !forceNew) {
    return {
      error: `A pin already exists ${Math.round(tooClose[0].distanceMeters)} m away. Use the existing location or confirm this is a different place.`,
      conflict: toPublicLocation(tooClose[0].location),
    }
  }

  if (tooClose.length > 0 && forceNew && tooClose[0].distanceMeters < 5) {
    return {
      error: 'Pins cannot be placed within 5 m of an existing location.',
      conflict: toPublicLocation(tooClose[0].location),
    }
  }

  const location = await Location.create({
    name: trimmedName,
    address: input.address?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    coordinates: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    category: (input.category as LocationCategory) ?? 'other',
    city: input.city?.trim() || 'Unknown',
    geohash: encodeGeohash(lat, lng),
    placeKey: input.placeKey ?? null,
    source: 'community',
    reports: [],
  })

  return { location: toPublicLocation(location) }
}

export async function addReportToLocation(
  locationId: string,
  report: Omit<IReport, '_id' | 'createdAt' | 'updatedAt'>,
) {
  const location = await Location.findByIdAndUpdate(
    locationId,
    {
      $push: {
        reports: {
          $each: [report],
          $position: 0,
        },
      },
    },
    { new: true },
  )

  return location ? toPublicLocation(location) : null
}
