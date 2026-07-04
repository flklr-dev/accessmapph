import { Router } from 'express'
import { validateSubmitBody, processReportSubmission } from '../services/reportService.js'

export const reportsRouter = Router()

reportsRouter.post('/', async (req, res) => {
  const validated = validateSubmitBody(req.body)
  if (typeof validated === 'string') {
    res.status(400).json({ error: validated })
    return
  }

  try {
    const result = await processReportSubmission(validated)

    if ('error' in result) {
      res.status(404).json({ error: result.error })
      return
    }

    res.status(201).json({ report: result.report, moderation: result.moderation })
  } catch (error) {
    console.error('Error processing report:', error)
    res.status(500).json({ error: 'Failed to process report.' })
  }
})
