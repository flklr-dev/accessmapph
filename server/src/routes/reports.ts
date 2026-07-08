import { Router } from 'express'
import { validateSubmitBody, processReportSubmission } from '../services/reportService.js'
import { voteOnReport, flagReport } from '../services/locationService.js'
import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../middleware/auth.js'
import { reportRateLimit, reportActionRateLimit } from '../middleware/rateLimit.js'

export const reportsRouter = Router()

reportsRouter.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  reportRateLimit,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.uid
    if (!userId) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const validated = validateSubmitBody(req.body, userId)
    if (typeof validated === 'string') {
      res.status(400).json({ error: validated })
      return
    }

    try {
      const result = await processReportSubmission(validated, userId)

      if ('error' in result) {
        res.status(404).json({ error: result.error })
        return
      }

      res.status(201).json({ report: result.report, moderation: result.moderation })
    } catch (error) {
      console.error('Error processing report:', error)
      res.status(500).json({ error: 'Failed to process report.' })
    }
  },
)

reportsRouter.post(
  '/:locationId/:reportId/vote',
  requireAuth,
  requireVerifiedEmail,
  reportActionRateLimit,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.uid
    if (!userId) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const direction = req.body?.direction
    if (direction !== 'up' && direction !== 'down') {
      res.status(400).json({ error: 'direction must be "up" or "down".' })
      return
    }

    try {
      const result = await voteOnReport(
        String(req.params.locationId),
        String(req.params.reportId),
        userId,
        direction,
      )
      if (result.error) {
        res.status(400).json({ error: result.error })
        return
      }
      res.status(200).json({ report: result.report })
    } catch (error) {
      console.error('Error voting on report:', error)
      res.status(500).json({ error: 'Failed to register vote.' })
    }
  },
)

reportsRouter.post(
  '/:locationId/:reportId/flag',
  requireAuth,
  requireVerifiedEmail,
  reportActionRateLimit,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.auth?.uid
    if (!userId) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    try {
      const result = await flagReport(String(req.params.locationId), String(req.params.reportId), userId)
      if (result.error) {
        res.status(400).json({ error: result.error })
        return
      }
      res.status(200).json({ report: result.report })
    } catch (error) {
      console.error('Error flagging report:', error)
      res.status(500).json({ error: 'Failed to flag report.' })
    }
  },
)
