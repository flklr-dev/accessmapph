import { Router } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { accountDeleteRateLimit, contributionsReadRateLimit, profileReadRateLimit } from '../middleware/rateLimit.js'
import { enqueueAccountDeletion } from '../jobs/accountDelete.js'
import { getJobStatus, jobOwnedBy } from '../lib/jobQueue.js'
import { getUserContributions, toPublicUser } from '../services/userService.js'

export const authRouter = Router()

/** Current signed-in user profile (creates/syncs Mongo user on first call). */
authRouter.get('/me', requireAuth, profileReadRateLimit, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }
  res.json({ user: toPublicUser(req.user) })
})

/** Profile + contribution history for the signed-in user. */
authRouter.get('/me/contributions', requireAuth, contributionsReadRateLimit, async (req: AuthenticatedRequest, res) => {
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

/** Queue permanent account deletion — returns immediately; work runs in background. */
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
      const user = req.user
      if (!user) {
        res.status(404).json({ error: 'Account not found.' })
        return
      }

      const jobId = await enqueueAccountDeletion(req.auth.uid)
      res.status(202).json({
        accepted: true,
        jobId,
        message: 'Account deletion started. You will be signed out shortly.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'AUTH_NOT_CONFIGURED') {
        res.status(503).json({ error: 'Authentication is not configured on the server.' })
        return
      }
      console.error('Error queueing account deletion:', error)
      res.status(500).json({ error: 'Could not start account deletion. Please try again.' })
    }
  },
)

/** Optional status poll for a queued account-deletion job (same user only). */
authRouter.get(
  '/me/deletion/:jobId',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!req.auth?.uid) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const jobId = String(req.params.jobId)
    const job = await getJobStatus(jobId)
    if (!job || job.name !== 'account.delete') {
      res.status(404).json({ error: 'Deletion job not found.' })
      return
    }

    const owned = await jobOwnedBy(jobId, req.auth.uid)
    if (!owned) {
      res.status(404).json({ error: 'Deletion job not found.' })
      return
    }

    res.json({ job })
  },
)
