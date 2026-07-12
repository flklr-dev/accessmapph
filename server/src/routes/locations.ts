import { Router } from 'express'
import {
  listLocationPins,
  getLocationById,
  createLocation,
  resolveLocationAt,
  searchLocationsByName,
  searchLocationsOnMap,
  searchExternalPlaces,
  parseLocationCityScope,
  parsePinLimit,
  parseBbox,
  type LocationPinQueryTiming,
} from '../services/locationService.js'
import { isNominatimTransientError } from '../lib/nominatim.js'
import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../middleware/auth.js'
import { geocodeResolveRateLimit, geocodeSearchRateLimit, locationCreateRateLimit, locationDetailReadRateLimit, locationPinsReadRateLimit } from '../middleware/rateLimit.js'
import { sendPublicCachedJson } from '../middleware/httpCache.js'

export const locationsRouter = Router()

/**
 * Map pin list — slim payloads for markers + filters.
 * Query: ?city=all|manila|cebu|davao & bbox=west,south,east,north & limit=2000
 * Full reports (photos, authors, descriptions) come from GET /:id on select.
 */
locationsRouter.get('/', locationPinsReadRateLimit, async (req, res) => {
  try {
    const city = parseLocationCityScope(req.query.city)
    const limit = parsePinLimit(req.query.limit)
    const bbox = parseBbox(req.query.bbox)
    let timing: LocationPinQueryTiming | undefined

    const locations = await listLocationPins({
      city,
      limit,
      ...(bbox ? { bbox } : {}),
      onTiming: (value) => {
        timing = value
      },
    })
    if (timing) {
      const locationsMs = Math.round(timing.locationsMs)
      const reportsMs = Math.round(timing.reportsMs)
      const transformMs = Math.round(timing.transformMs)
      res.setHeader(
        'Server-Timing',
        `locations;dur=${locationsMs}, reports;dur=${reportsMs}, transform;dur=${transformMs}`,
      )
      console.log(JSON.stringify({
        level: 'info',
        type: 'location_pins_timing',
        requestId: res.getHeader('X-Request-Id'),
        city,
        locationsMs,
        reportsMs,
        transformMs,
        locationCount: timing.locationCount,
        reportCount: timing.reportCount,
      }))
    }
    sendPublicCachedJson(req, res, locations, {
      maxAge: 30,
      staleWhileRevalidate: 60,
    })
  } catch (error) {
    console.error('Error fetching locations:', error)
    res.status(500).json({ error: 'Failed to fetch locations.' })
  }
})

function parseSearchQuery(req: { query: { q?: unknown; limit?: unknown } }) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(Number(req.query.limit) || 6, 10)
  return { query, limit }
}

/** Fast map-pin search — MongoDB only, no geocoder wait. */
locationsRouter.get('/search/on-map', locationPinsReadRateLimit, async (req, res) => {
  const { query, limit } = parseSearchQuery(req)

  if (query.length < 2) {
    res.status(400).json({ error: 'Search query must be at least 2 characters.' })
    return
  }

  try {
    const onMap = await searchLocationsOnMap(query, limit)
    sendPublicCachedJson(req, res, { onMap }, { maxAge: 30, staleWhileRevalidate: 60 })
  } catch (error) {
    console.error('Error searching map locations:', error)
    res.status(500).json({ error: 'Failed to search map locations.' })
  }
})

/** External place search — OpenStreetMap Nominatim (rate-limited, cached). */
locationsRouter.get('/search/places', geocodeSearchRateLimit, async (req, res) => {
  const { query, limit } = parseSearchQuery(req)

  if (query.length < 2) {
    res.status(400).json({ error: 'Search query must be at least 2 characters.' })
    return
  }

  try {
    const places = await searchExternalPlaces(query, limit)
    sendPublicCachedJson(req, res, { places }, { maxAge: 60, staleWhileRevalidate: 120 })
  } catch (error) {
    if (isNominatimTransientError(error)) {
      sendPublicCachedJson(req, res, { places: [], geocoderUnavailable: true }, { maxAge: 5 })
      return
    }
    console.error('Error searching external places:', error)
    res.status(500).json({ error: 'Failed to search external places.' })
  }
})

/** Legacy combined search — kept for backward compatibility. Prefer split endpoints. */
locationsRouter.get('/search', geocodeSearchRateLimit, async (req, res) => {
  const { query, limit } = parseSearchQuery(req)

  if (query.length < 2) {
    res.status(400).json({ error: 'Search query must be at least 2 characters.' })
    return
  }

  try {
    const [onMap, placesOutcome] = await Promise.all([
      searchLocationsOnMap(query, limit),
      searchExternalPlaces(query, limit)
        .then((places) => ({ places, geocoderUnavailable: false as const }))
        .catch((error) => {
          if (isNominatimTransientError(error)) {
            return { places: [] as const, geocoderUnavailable: true as const }
          }
          throw error
        }),
    ])

    sendPublicCachedJson(
      req,
      res,
      {
        onMap,
        places: placesOutcome.places,
        ...(placesOutcome.geocoderUnavailable ? { geocoderUnavailable: true } : {}),
      },
      { maxAge: 30, staleWhileRevalidate: 60 },
    )
  } catch (error) {
    console.error('Error searching places:', error)
    res.status(500).json({ error: 'Failed to search places.' })
  }
})

locationsRouter.get('/:id', locationDetailReadRateLimit, async (req, res) => {
  try {
    const location = await getLocationById(String(req.params.id))
    if (!location) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
    sendPublicCachedJson(req, res, location, {
      maxAge: 60,
      staleWhileRevalidate: 120,
    })
  } catch (error) {
    console.error('Error fetching location:', error)
    res.status(500).json({ error: 'Failed to fetch location.' })
  }
})

locationsRouter.post('/resolve', geocodeResolveRateLimit, async (req, res) => {
  const { lat, lng } = req.body ?? {}

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'lat and lng are required numbers.' })
    return
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Invalid coordinates.' })
    return
  }

  try {
    const result = await resolveLocationAt(lat, lng)
    if (result.action === 'invalid' && result.reason === 'geocoder_unavailable') {
      res.status(503).json({
        error: result.message,
        code: 'GEOCODER_UNAVAILABLE',
      })
      return
    }
    res.json(result)
  } catch (error) {
    console.error('Error resolving location:', error)
    res.status(500).json({ error: 'Failed to resolve location.' })
  }
})

locationsRouter.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  locationCreateRateLimit,
  async (req: AuthenticatedRequest, res) => {
    const { lat, lng, name, address, city, category, placeKey, forceNew } = req.body ?? {}

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng are required numbers.' })
      return
    }
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'name is required.' })
      return
    }

    const createdBy = req.auth?.uid
    if (!createdBy) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    try {
      const result = await createLocation({
        lat,
        lng,
        name,
        address: typeof address === 'string' ? address : undefined,
        city: typeof city === 'string' ? city : undefined,
        category: typeof category === 'string' ? category : undefined,
        placeKey: typeof placeKey === 'string' ? placeKey : null,
        forceNew: forceNew === true,
        createdBy,
      })

      if (result.error) {
        const status = result.errorCode === 'GEOCODER_UNAVAILABLE' ? 503 : result.conflict ? 409 : 400
        res.status(status).json({
          error: result.error,
          ...(result.conflict ? { conflict: result.conflict } : {}),
          ...(result.errorCode ? { code: result.errorCode } : {}),
        })
        return
      }

      res.status(201).json({ location: result.location })
    } catch (error) {
      console.error('Error creating location:', error)
      res.status(500).json({ error: 'Failed to create location.' })
    }
  },
)
