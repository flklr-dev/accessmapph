import mongoose from 'mongoose'
import { Location, type ILocation, type LocationCategory, type LocationJSON } from '../models/Location.js'
import { Report, toFullReport, toSlimReport, type IReportDoc } from '../models/Report.js'
import { encodeGeohash, MATCH_RADIUS_METERS, MIN_SEPARATION_METERS, STRONG_MATCH_RADIUS_METERS } from '../lib/geo.js'
import { findLocationsBySearchQuery } from '../lib/locationSearch.js'
import { verifyPhilippineLocation, type GeofenceRejectionReason } from '../lib/nominatim.js'
import { getAuthorsByUids, recordReportFlag, recordReportVerified } from './userService.js'

export interface LocationCandidate {
  location: LocationJSON
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
  location?: LocationJSON
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

/** Location fields only — reports are assembled from the Report collection. */
function toPublicLocationBase(doc: ILocation): LocationJSON {
  const json = doc.toJSON() as unknown as LocationJSON
  return { ...json, reports: json.reports ?? [], reportsLoaded: false }
}

async function attachSlimReports(locations: LocationJSON[]): Promise<LocationJSON[]> {
  if (locations.length === 0) return locations

  const ids = locations.map((l) => new mongoose.Types.ObjectId(l.id))
  const reports = await Report.find({ locationId: { $in: ids } })
    .select('locationId featureType status aiVerdict verified upvotes downvotes createdAt')
    .sort({ createdAt: -1 })
    .lean()

  const byLocation = new Map<string, ReturnType<typeof toSlimReport>[]>()
  for (const r of reports) {
    const key = String(r.locationId)
    const list = byLocation.get(key) ?? []
    list.push(toSlimReport(r))
    byLocation.set(key, list)
  }

  return locations.map((loc) => ({
    ...loc,
    reports: byLocation.get(loc.id) ?? [],
    reportsLoaded: false,
  }))
}

async function attachFullReports(location: LocationJSON): Promise<LocationJSON> {
  const reports = await Report.find({ locationId: location.id })
    .sort({ createdAt: -1 })
    .lean()

  const authorMap = await getAuthorsByUids(reports.map((r) => r.userId))
  return {
    ...location,
    reports: reports.map((r) => {
      const author = r.userId ? authorMap.get(r.userId) : undefined
      return toFullReport(r, author)
    }),
    reportsLoaded: true,
  }
}

/** City scopes used by the map "spaces" UI — keep in sync with leaderboard. */
export type LocationCityScope = 'all' | 'manila' | 'cebu' | 'davao'

const CITY_SCOPE_PATTERNS: Record<Exclude<LocationCityScope, 'all'>, RegExp> = {
  manila: /manila/i,
  cebu: /cebu/i,
  davao: /davao/i,
}

const DEFAULT_PIN_LIMIT = 2000
const MAX_PIN_LIMIT = 5000

const PIN_LIST_PROJECTION = {
  name: 1,
  address: 1,
  coordinates: 1,
  category: 1,
  city: 1,
  geohash: 1,
  placeKey: 1,
  source: 1,
  createdAt: 1,
} as const

export interface ListLocationPinsOptions {
  city?: LocationCityScope
  /** west,south,east,north in WGS84 degrees */
  bbox?: { west: number; south: number; east: number; north: number }
  limit?: number
}

export interface LocationPinJSON {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  category: LocationCategory
  city: string
  geohash: string
  placeKey: string | null
  source: string
  /** False until GET /api/locations/:id hydrates full report payloads. */
  reportsLoaded: false
  reports: ReturnType<typeof toSlimReport>[]
  createdAt?: string
}

export function parseLocationCityScope(value: unknown): LocationCityScope {
  if (value === 'manila' || value === 'cebu' || value === 'davao' || value === 'all') {
    return value
  }
  return 'all'
}

export function parsePinLimit(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PIN_LIMIT
  return Math.min(Math.floor(n), MAX_PIN_LIMIT)
}

/** Parse `bbox=west,south,east,north` query string. Returns null if invalid. */
export function parseBbox(value: unknown): ListLocationPinsOptions['bbox'] | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parts = value.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [west, south, east, north] = parts
  if (west >= east || south >= north) return null
  if (west < -180 || east > 180 || south < -90 || north > 90) return null
  return { west, south, east, north }
}

/**
 * Lightweight map pin list — no author enrichment, no photo URLs, no descriptions.
 * Use GET /api/locations/:id for the full report payload when a pin is selected.
 */
export async function listLocationPins(
  options: ListLocationPinsOptions = {},
): Promise<LocationPinJSON[]> {
  const city = options.city ?? 'all'
  const limit = options.limit ?? DEFAULT_PIN_LIMIT
  const filter: Record<string, unknown> = {}

  if (city !== 'all') {
    filter.city = CITY_SCOPE_PATTERNS[city]
  }

  if (options.bbox) {
    const { west, south, east, north } = options.bbox
    filter.coordinates = {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ]],
        },
      },
    }
  }

  const locations = await Location.find(filter)
    .select(PIN_LIST_PROJECTION)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  if (locations.length === 0) return []

  const locationIds = locations.map((loc) => loc._id)
  const reports = await Report.find({ locationId: { $in: locationIds } })
    .select('locationId featureType status aiVerdict verified upvotes downvotes createdAt')
    .sort({ createdAt: -1 })
    .lean()

  const byLocation = new Map<string, ReturnType<typeof toSlimReport>[]>()
  for (const r of reports) {
    const key = String(r.locationId)
    const list = byLocation.get(key) ?? []
    list.push(toSlimReport(r))
    byLocation.set(key, list)
  }

  return locations.map((loc) => {
    const locationId = loc._id.toString()
    return {
      id: locationId,
      name: loc.name,
      address: loc.address,
      lat: loc.coordinates.coordinates[1],
      lng: loc.coordinates.coordinates[0],
      category: loc.category,
      city: loc.city,
      geohash: loc.geohash,
      placeKey: loc.placeKey,
      source: loc.source,
      reportsLoaded: false as const,
      reports: byLocation.get(locationId) ?? [],
      createdAt: loc.createdAt?.toISOString(),
    }
  })
}

export async function searchLocationsByName(query: string, limit = 6) {
  const locations = await findLocationsBySearchQuery(query, limit)
  const bases = locations.map((loc) => toPublicLocationBase(loc))
  return attachSlimReports(bases)
}

export async function getLocationById(id: string) {
  const location = await Location.findById(id)
  if (!location) return null
  return attachFullReports(toPublicLocationBase(location))
}

/** Location existence check without loading reports (for report submission). */
export async function locationExists(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false
  const count = await Location.countDocuments({ _id: id })
  return count > 0
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

async function toPublicWithSlimReports(doc: ILocation): Promise<LocationJSON> {
  const [withReports] = await attachSlimReports([toPublicLocationBase(doc)])
  return withReports
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
        location: await toPublicWithSlimReports(byKey),
        distanceMeters: 0,
        matchReason: 'place_key',
        suggestion,
      }
    }
  }

  const nearby = await findNearbyLocations(lat, lng, MATCH_RADIUS_METERS)
  const candidates = await Promise.all(
    nearby.map(async ({ location, distanceMeters }) => ({
      location: await toPublicWithSlimReports(location),
      distanceMeters,
      matchReason:
        distanceMeters <= STRONG_MATCH_RADIUS_METERS
          ? ('strong_proximity' as const)
          : ('proximity' as const),
    })),
  )

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
  location?: LocationJSON
  error?: string
  conflict?: LocationJSON
  errorCode?: 'GEOCODER_UNAVAILABLE'
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
    return {
      error: geofence.message,
      ...(geofence.reason === 'geocoder_unavailable'
        ? { errorCode: 'GEOCODER_UNAVAILABLE' as const }
        : {}),
    }
  }

  if (input.placeKey && !forceNew) {
    const existing = await findLocationByPlaceKey(input.placeKey)
    if (existing) {
      return {
        error: 'This place already exists on the map.',
        conflict: await toPublicWithSlimReports(existing),
      }
    }
  }

  const tooClose = await findNearbyLocations(lat, lng, MIN_SEPARATION_METERS)

  if (tooClose.length > 0 && !forceNew) {
    return {
      error: `A pin already exists ${Math.round(tooClose[0].distanceMeters)} m away. Use the existing location or confirm this is a different place.`,
      conflict: await toPublicWithSlimReports(tooClose[0].location),
    }
  }

  if (tooClose.length > 0 && forceNew && tooClose[0].distanceMeters < 5) {
    return {
      error: 'Pins cannot be placed within 5 m of an existing location.',
      conflict: await toPublicWithSlimReports(tooClose[0].location),
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
  })

  return {
    location: {
      ...toPublicLocationBase(location),
      reports: [],
      reportsLoaded: true,
    },
  }
}

export async function createReport(
  locationId: string,
  report: {
    userId: string
    featureType: IReportDoc['featureType']
    status: IReportDoc['status']
    description?: string
    photos: string[]
    upvotes: number
    downvotes: number
    verified: boolean
    aiVerdict: IReportDoc['aiVerdict']
    upvoterIds: string[]
    downvoterIds: string[]
    flaggerIds: string[]
  },
) {
  if (!(await locationExists(locationId))) return null

  const created = await Report.create({
    locationId,
    ...report,
  })

  return created
}

/** Recent reports at a location for moderation duplicate checks. */
export async function getReportsForModeration(locationId: string) {
  return Report.find({ locationId })
    .select('userId featureType createdAt')
    .lean()
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

async function toPublicReportDoc(report: IReportDoc): Promise<PublicReport> {
  const authorMap = await getAuthorsByUids([report.userId])
  const author = report.userId ? authorMap.get(report.userId) : undefined
  return toFullReport(report, author)
}

export async function voteOnReport(
  locationId: string,
  reportId: string,
  userId: string,
  direction: 'up' | 'down',
): Promise<ReportActionResult> {
  if (!mongoose.Types.ObjectId.isValid(reportId) || !mongoose.Types.ObjectId.isValid(locationId)) {
    return { error: 'Report not found.' }
  }

  const report = await Report.findOne({ _id: reportId, locationId })
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

  await report.save()

  if (report.userId) {
    if (!wasFlagged && report.aiVerdict === 'flagged') {
      await recordReportFlag(report.userId)
    } else if (!wasVerified && report.verified) {
      await recordReportVerified(report.userId, wasPending)
    }
  }

  return { report: await toPublicReportDoc(report) }
}

export async function flagReport(
  locationId: string,
  reportId: string,
  userId: string,
): Promise<ReportActionResult> {
  if (!mongoose.Types.ObjectId.isValid(reportId) || !mongoose.Types.ObjectId.isValid(locationId)) {
    return { error: 'Report not found.' }
  }

  const report = await Report.findOne({ _id: reportId, locationId })
  if (!report) return { error: 'Report not found.' }

  if (report.userId === userId) {
    return { error: 'You cannot flag your own report.' }
  }

  if (report.flaggerIds.includes(userId)) {
    return { report: await toPublicReportDoc(report) }
  }

  const wasFlagged = report.aiVerdict === 'flagged'
  report.flaggerIds.push(userId)

  if (!wasFlagged && report.flaggerIds.length >= FLAG_HIDE_THRESHOLD) {
    report.aiVerdict = 'flagged'
    report.verified = false
  }

  await report.save()

  if (!wasFlagged && report.aiVerdict === 'flagged' && report.userId) {
    await recordReportFlag(report.userId)
  }

  return { report: await toPublicReportDoc(report) }
}
