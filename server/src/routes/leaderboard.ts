import { Router } from 'express'
import {
  getLeaderboard,
  parseLeaderboardCity,
  parseLeaderboardLimit,
} from '../services/leaderboardService.js'

export const leaderboardRouter = Router()

/**
 * Public leaderboard — no auth required.
 * Query: ?city=all|manila|cebu|davao&limit=25
 */
leaderboardRouter.get('/', async (req, res) => {
  try {
    const city = parseLeaderboardCity(req.query.city)
    const limit = parseLeaderboardLimit(req.query.limit)
    const result = await getLeaderboard(city, limit)
    res.json(result)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    res.status(500).json({ error: 'Failed to load leaderboard.' })
  }
})
