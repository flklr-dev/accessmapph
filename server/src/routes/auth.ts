import { Router } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { toPublicUser } from '../services/userService.js'

export const authRouter = Router()

/** Current signed-in user profile (creates/syncs Mongo user on first call). */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  res.json({ user: toPublicUser(req.user) })
})
