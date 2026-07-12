import { Router } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { feedbackRateLimit } from '../middleware/rateLimit.js'
import { createFeedback, validateSubmitFeedbackBody } from '../services/feedbackService.js'

export const feedbackRouter = Router()

/** Submit signed-in user feedback (suggestions, bugs, etc.). */
feedbackRouter.post('/', requireAuth, feedbackRateLimit, async (req: AuthenticatedRequest, res) => {
  const user = req.user
  if (!user) {
    res.status(401).json({ error: 'Sign in required.' })
    return
  }

  const validated = validateSubmitFeedbackBody(req.body)
  if (typeof validated === 'string') {
    res.status(400).json({ error: validated })
    return
  }

  try {
    const feedback = await createFeedback(user, validated)
    res.status(201).json({ feedback })
  } catch (error) {
    console.error('Error creating feedback:', error)
    res.status(500).json({ error: 'Failed to send feedback. Please try again.' })
  }
})
