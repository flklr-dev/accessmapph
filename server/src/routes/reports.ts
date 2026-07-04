import { Router } from 'express'
import { validateSubmitBody, processReportSubmission } from '../services/reportService.js'
import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../middleware/auth.js'
import { reportRateLimit } from '../middleware/rateLimit.js'

export const reportsRouter = Router()

reportsRouter.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  reportRateLimit,
  async (req: AuthenticatedRequest, res) => {
    const validated = validateSubmitBody(req.body)
    if (typeof validated === 'string') {
      res.status(400).json({ error: validated })
      return
    }

    const userId = req.auth?.uid
    if (!userId) {
      res.status(401).json({ error: 'Sign in required.' })
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
