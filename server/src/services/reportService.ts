import { type FeatureType, type AccessibilityStatus, type AIVerdict } from '../models/Location.js'
import { getLocationById, addReportToLocation } from './locationService.js'

const SPAM_PATTERNS = [
  /^(.)\1{6,}$/,
  /^(test|asdf|qwerty|lorem|spam|fake|xxx+)$/i,
  /(https?:\/\/|www\.)/i,
]

const MODERATION_DELAY_MS = 800

export interface SubmitReportBody {
  locationId: string
  featureType: FeatureType
  status: 'accessible' | 'partial' | 'inaccessible'
  description?: string
}

export interface ModerationResult {
  valid: boolean
  reason: string
  confidence: number
}

export interface ReportOutput {
  id: string
  locationId: string
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: AIVerdict
  createdAt: string
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isDuplicate(
  reports: Array<{ featureType: string; createdAt?: string }>,
  featureType: string,
  withinHours = 24,
): boolean {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000
  return reports.some(
    (r) =>
      r.featureType === featureType &&
      r.createdAt &&
      new Date(r.createdAt).getTime() > cutoff,
  )
}

function moderateReport(
  body: SubmitReportBody,
  existingReports: Array<{ featureType: string; createdAt?: string }>,
): ModerationResult {
  const description = body.description?.trim() ?? ''

  if (description && description.length < 8) {
    return {
      valid: false,
      reason: 'Description is too short to be useful.',
      confidence: 0.85,
    }
  }

  if (description && SPAM_PATTERNS.some((p) => p.test(description))) {
    return {
      valid: false,
      reason: 'Report appears to be spam or not about accessibility.',
      confidence: 0.92,
    }
  }

  if (isDuplicate(existingReports, body.featureType)) {
    return {
      valid: false,
      reason: 'A similar report for this feature was submitted recently.',
      confidence: 0.88,
    }
  }

  return {
    valid: true,
    reason: 'Report is relevant and passes automated checks.',
    confidence: 0.95,
  }
}

const FEATURE_TYPES = new Set(['ramp', 'elevator', 'restroom', 'parking', 'pathway', 'signage'])
const REPORT_STATUSES = new Set(['accessible', 'partial', 'inaccessible'])

export function validateSubmitBody(body: unknown): SubmitReportBody | string {
  if (!body || typeof body !== 'object') return 'Invalid request body.'

  const { locationId, featureType, status, description } = body as Record<string, unknown>

  if (typeof locationId !== 'string' || !locationId) {
    return 'Location ID is required.'
  }
  if (typeof featureType !== 'string' || !FEATURE_TYPES.has(featureType)) {
    return 'Invalid feature type.'
  }
  if (typeof status !== 'string' || !REPORT_STATUSES.has(status)) {
    return 'Invalid accessibility status.'
  }
  if (description !== undefined && typeof description !== 'string') {
    return 'Description must be a string.'
  }
  if (typeof description === 'string' && description.length > 280) {
    return 'Description must be 280 characters or fewer.'
  }

  return {
    locationId,
    featureType: featureType as FeatureType,
    status: status as SubmitReportBody['status'],
    description: typeof description === 'string' ? description.trim() : undefined,
  }
}

export async function processReportSubmission(
  body: SubmitReportBody,
): Promise<{ report: ReportOutput; moderation: ModerationResult } | { error: string }> {
  await delay(MODERATION_DELAY_MS)

  const location = await getLocationById(body.locationId)
  if (!location) {
    return { error: 'Location not found.' }
  }

  const moderation = moderateReport(body, location.reports ?? [])

  const reportData = {
    featureType: body.featureType,
    status: body.status as AccessibilityStatus,
    description: body.description || undefined,
    upvotes: 0,
    downvotes: 0,
    verified: false,
    aiVerdict: (moderation.valid ? 'approved' : 'flagged') as AIVerdict,
  }

  const updatedLocation = await addReportToLocation(body.locationId, reportData)

  if (!updatedLocation) {
    return { error: 'Failed to add report.' }
  }

  const newReport = updatedLocation.reports[0]

  return {
    report: newReport as ReportOutput,
    moderation,
  }
}
