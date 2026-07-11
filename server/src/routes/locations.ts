import { Router } from 'express'
import {
  listLocationPins,
  getLocationById,
  createLocation,
  resolveLocationAt,
  searchLocationsByName,
  parseLocationCityScope,
  parsePinLimit,
  parseBbox,
} from '../services/locationService.js'
import { searchPlaces } from '../lib/nominatim.js'
import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../middleware/auth.js'
import { geocodeResolveRateLimit, geocodeSearchRateLimit, locationCreateRateLimit } from '../middleware/rateLimit.js'

export const locationsRouter = Router()

/**
 * Map pin list — slim payloads for markers + filters.
 * Query: ?city=all|manila|cebu|davao & bbox=west,south,east,north & limit=2000
 * Full reports (photos, authors, descriptions) come from GET /:id on select.
 */
locationsRouter.get('/', async (req, res) => {
  try {
    const city = parseLocationCityScope(req.query.city)
    const limit = parsePinLimit(req.query.limit)
    const bbox = parseBbox(req.query.bbox)

    const locations = await listLocationPins({
      city,
      limit,
      ...(bbox ? { bbox } : {}),
    })
    res.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
    res.status(500).json({ error: 'Failed to fetch locations.' })
  }
})

/** Search places by name — map pins + OpenStreetMap */
locationsRouter.get('/search', geocodeSearchRateLimit, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(Number(req.query.limit) || 6, 10)

  if (query.length < 2) {
    res.status(400).json({ error: 'Search query must be at least 2 characters.' })
    return
  }

  try {
    const [onMap, places] = await Promise.all([
      searchLocationsByName(query, limit),
      searchPlaces(query, limit),
    ])

    res.json({ onMap, places })
  } catch (error) {
    console.error('Error searching places:', error)
    res.status(500).json({ error: 'Failed to search places.' })
  }
})

locationsRouter.get('/:id', async (req, res) => {
  try {
    const location = await getLocationById(req.params.id)
    if (!location) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
    res.json(location)
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
        res.status(result.conflict ? 409 : 400).json({
          error: result.error,
          conflict: result.conflict,
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
