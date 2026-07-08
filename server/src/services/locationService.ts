import { Location, type ILocation, type IReport, type LocationCategory, type LocationJSON } from '../models/Location.js'
import { encodeGeohash, MATCH_RADIUS_METERS, MIN_SEPARATION_METERS, STRONG_MATCH_RADIUS_METERS } from '../lib/geo.js'
import { verifyPhilippineLocation, type GeofenceRejectionReason } from '../lib/nominatim.js'
import { getAuthorsByUids, recordReportFlag, recordReportVerified } from './userService.js'

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

export type ResolveAction = 'matched' | 'nearby' | 'new' | 'invalid'

export interface ResolveResult {
  action: ResolveAction
  tap: { lat: number; lng: number }
  location?: ReturnType<typeof toPublicLocation>
  distanceMeters?: number
  matchReason?: LocationCandidate['matchReason']
  candidates?: LocationCandidate[]
  suggestion?: LocationSuggestion
  reason?: GeofenceRejectionReason
  message?: string
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
  createdBy?: string
}

function toPublicLocation(doc: ILocation): LocationJSON {
  return doc.toJSON() as unknown as LocationJSON
}

export async function getAllLocations() {
  const locations = await Location.find().sort({ createdAt: -1 }).lean()

  const authorMap = await getAuthorsByUids(
    locations.flatMap((loc) => loc.reports.map((r) => r.userId)),
  )

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
      reports: loc.reports.map((r) => {
        const author = r.userId ? authorMap.get(r.userId) : undefined
        return {
          id: r._id.toString(),
          locationId: loc._id.toString(),
          authorName: r.userId ? author?.name ?? 'Contributor' : null,
          authorPhotoURL: author?.photoURL ?? null,
          featureType: r.featureType,
          status: r.status,
          description: r.description,
          photos: Array.isArray(r.photos) ? r.photos : [],
          upvotes: r.upvotes,
          downvotes: r.downvotes,
          verified: r.verified,
          aiVerdict: r.aiVerdict,
          createdAt: r.createdAt?.toISOString(),
        }
      }),
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

  const results = locations.map((loc) => toPublicLocation(loc))
  return attachAuthorNames(results)
}

export async function getLocationById(id: string) {
  const location = await Location.findById(id)
  if (!location) return null
  const json = toPublicLocation(location)
  const [withNames] = await attachAuthorNames([json])
  return withNames
}

/** Batched author enrichment for already-serialized locations (privacy: first name + avatar only). */
async function attachAuthorNames<
  T extends { reports: Array<{ userId?: string; authorName?: string | null; authorPhotoURL?: string | null }> },
>(locations: T[]): Promise<T[]> {
  const authorMap = await getAuthorsByUids(
    locations.flatMap((loc) => loc.reports.map((r) => r.userId)),
  )

  return locations.map((loc) => ({
    ...loc,
    reports: loc.reports.map((r) => {
      const author = r.userId ? authorMap.get(r.userId) : undefined
      return {
        ...r,
        authorName: r.userId ? author?.name ?? 'Contributor' : null,
        authorPhotoURL: author?.photoURL ?? null,
      }
    }),
  }))
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

  const geofence = await verifyPhilippineLocation(lat, lng)
  if (!geofence.valid) {
    return { action: 'invalid', tap, reason: geofence.reason, message: geofence.message }
  }

  const suggestion = geofence.geocode ?? null

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

  // Defense in depth — the pin flow already gates this via /resolve, but a
  // location can only ever be created here, so re-verify server-side too.
  const geofence = await verifyPhilippineLocation(lat, lng)
  if (!geofence.valid) {
    return { error: geofence.message }
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
    createdBy: input.createdBy ?? null,
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

// ---- Tier 3: free community moderation (votes + flags) --------------------

/** Net upvotes needed to confirm a pending/approved report as community-verified. */
const UPVOTE_VERIFY_THRESHOLD = 3
/** Net downvotes needed to hide a report as flagged. */
const DOWNVOTE_HIDE_THRESHOLD = 3
/** Distinct flags needed to hide a report as flagged, regardless of votes. */
const FLAG_HIDE_THRESHOLD = 3

export interface PublicReport {
  id: string
  locationId: string
  authorName?: string | null
  authorPhotoURL?: string | null
  featureType: string
  status: string
  description?: string
  photos: string[]
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: string
  createdAt?: string
}

export interface ReportActionResult {
  report?: PublicReport
  error?: string
}

async function toPublicReport(locationId: string, r: IReport): Promise<PublicReport> {
  const authorMap = await getAuthorsByUids([r.userId])
  const author = r.userId ? authorMap.get(r.userId) : undefined
  return {
    id: r._id.toString(),
    locationId,
    authorName: r.userId ? author?.name ?? 'Contributor' : null,
    authorPhotoURL: author?.photoURL ?? null,
    featureType: r.featureType,
    status: r.status,
    description: r.description,
    photos: Array.isArray(r.photos) ? r.photos : [],
    upvotes: r.upvotes,
    downvotes: r.downvotes,
    verified: r.verified,
    aiVerdict: r.aiVerdict,
    createdAt: r.createdAt?.toISOString(),
  }
}

export async function voteOnReport(
  locationId: string,
  reportId: string,
  userId: string,
  direction: 'up' | 'down',
): Promise<ReportActionResult> {
  const location = await Location.findById(locationId)
  if (!location) return { error: 'Location not found.' }

  const report = location.reports.id(reportId)
  if (!report) return { error: 'Report not found.' }

  if (report.userId === userId) {
    return { error: 'You cannot vote on your own report.' }
  }

  const wasVerified = report.verified
  const wasFlagged = report.aiVerdict === 'flagged'
  const wasPending = report.aiVerdict === 'pending'
  const wasInUp = report.upvoterIds.includes(userId)
  const wasInDown = report.downvoterIds.includes(userId)

  // Toggle: clicking the same direction twice retracts the vote.
  report.upvoterIds = report.upvoterIds.filter((id: string) => id !== userId)
  report.downvoterIds = report.downvoterIds.filter((id: string) => id !== userId)
  if (direction === 'up' && !wasInUp) report.upvoterIds.push(userId)
  if (direction === 'down' && !wasInDown) report.downvoterIds.push(userId)

  report.upvotes = report.upvoterIds.length
  report.downvotes = report.downvoterIds.length

  const net = report.upvotes - report.downvotes

  if (!wasFlagged && net <= -DOWNVOTE_HIDE_THRESHOLD) {
    report.aiVerdict = 'flagged'
    report.verified = false
  } else if (report.aiVerdict !== 'flagged' && net >= UPVOTE_VERIFY_THRESHOLD) {
    report.verified = true
    if (report.aiVerdict === 'pending') report.aiVerdict = 'approved'
  }

  await location.save()

  if (report.userId) {
    if (!wasFlagged && report.aiVerdict === 'flagged') {
      await recordReportFlag(report.userId)
    } else if (!wasVerified && report.verified) {
      await recordReportVerified(report.userId, wasPending)
    }
  }

  return { report: await toPublicReport(locationId, report) }
}

export async function flagReport(
  locationId: string,
  reportId: string,
  userId: string,
): Promise<ReportActionResult> {
  const location = await Location.findById(locationId)
  if (!location) return { error: 'Location not found.' }

  const report = location.reports.id(reportId)
  if (!report) return { error: 'Report not found.' }

  if (report.userId === userId) {
    return { error: 'You cannot flag your own report.' }
  }

  if (report.flaggerIds.includes(userId)) {
    return { report: await toPublicReport(locationId, report) }
  }

  const wasFlagged = report.aiVerdict === 'flagged'
  report.flaggerIds.push(userId)

  if (!wasFlagged && report.flaggerIds.length >= FLAG_HIDE_THRESHOLD) {
    report.aiVerdict = 'flagged'
    report.verified = false
  }

  await location.save()

  if (!wasFlagged && report.aiVerdict === 'flagged' && report.userId) {
    await recordReportFlag(report.userId)
  }

  return { report: await toPublicReport(locationId, report) }
}
