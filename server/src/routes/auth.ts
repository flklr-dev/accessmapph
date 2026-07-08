import { Router } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { accountDeleteRateLimit } from '../middleware/rateLimit.js'
import { deleteUserAccount, getUserContributions, toPublicUser } from '../services/userService.js'

export const authRouter = Router()

/** Current signed-in user profile (creates/syncs Mongo user on first call). */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  res.json({ user: toPublicUser(req.user) })
})

/** Profile + contribution history for the signed-in user. */
authRouter.get('/me/contributions', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.auth?.uid) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  try {
    const contributions = await getUserContributions(req.auth.uid)
    res.json({
      user: toPublicUser(req.user),
      contributions,
    })
  } catch (error) {
    console.error('Error fetching contributions:', error)
    res.status(500).json({ error: 'Failed to load contribution history.' })
  }
})

/** Permanently delete the signed-in account and all associated personal data. */
authRouter.delete(
  '/me',
  requireAuth,
  accountDeleteRateLimit,
  async (req: AuthenticatedRequest, res) => {
    if (!req.auth?.uid) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    try {
      await deleteUserAccount(req.auth.uid)
      res.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'USER_NOT_FOUND') {
        res.status(404).json({ error: 'Account not found.' })
        return
      }
      if (message === 'AUTH_NOT_CONFIGURED') {
        res.status(503).json({ error: 'Authentication is not configured on the server.' })
        return
      }
      console.error('Error deleting account:', error)
      res.status(500).json({ error: 'Could not delete account. Please try again or contact support.' })
    }
  },
)
