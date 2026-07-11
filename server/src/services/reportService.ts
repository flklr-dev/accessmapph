import { type FeatureType, type AccessibilityStatus, type AIVerdict } from '../models/Location.js'
import {
  createReport,
  getReportsForModeration,
  locationExists,
} from './locationService.js'
import { recordReportContribution, getTrustStatus, getAuthorsByUids } from './userService.js'
import { isOwnCloudinaryUrlForUser, MAX_PHOTOS_PER_REPORT } from '../lib/cloudinary.js'
import { toFullReport } from '../models/Report.js'

// ---- Tier 1: free, instant rule engine -----------------------------------

const SPAM_PATTERNS = [
  /^(.)\1{6,}$/, // aaaaaaa
  /^(test|asdf|qwerty|lorem|spam|fake|xxx+)$/i,
  /(https?:\/\/|www\.)/i, // links
  /\b\d{4,}[-.\s]?\d{3,}[-.\s]?\d{3,}\b/, // phone-number-shaped strings
  /(.)\1{5,}/, // any char repeated 6+ times anywhere (e.g. "soooooo good")
]

const NONSENSE_WORDS = new Set([
  'asdf',
  'asdfgh',
  'qwerty',
  'lorem',
  'ipsum',
  'test123',
  'idk',
  'na',
  'wala',
])

/** Ratio of vowels to letters below this, over a long-enough run, reads as keyboard-mash. */
function looksLikeGibberish(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 8) return false

  const vowels = letters.match(/[aeiouAEIOU]/g)?.length ?? 0
  const vowelRatio = vowels / letters.length
  if (vowelRatio < 0.12) return true

  // 6+ consecutive consonants ("qzxcvbn") almost never occurs in real words.
  if (/[^aeiouAEIOU\s]{6,}/.test(text)) return true

  return false
}

function isShoutingCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 12) return false
  const upper = letters.match(/[A-Z]/g)?.length ?? 0
  return upper / letters.length > 0.85
}

export interface SubmitReportBody {
  locationId: string
  featureType: FeatureType
  status: 'accessible' | 'partial' | 'inaccessible'
  description?: string
  photos: string[]
}

export interface ModerationResult {
  valid: boolean
  verdict: AIVerdict
  reason: string
  confidence: number
}

export interface ReportOutput {
  id: string
  locationId: string
  userId?: string
  authorName?: string | null
  authorPhotoURL?: string | null
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  photos: string[]
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: AIVerdict
  createdAt: string
}

function isDuplicateForUser(
  reports: Array<{ featureType: string; userId?: string; createdAt?: Date | string }>,
  featureType: string,
  userId: string,
  withinHours = 24,
): boolean {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000
  return reports.some(
    (r) =>
      r.featureType === featureType &&
      r.userId === userId &&
      r.createdAt &&
      new Date(r.createdAt).getTime() > cutoff,
  )
}

/** Tier 1: free rule-based checks. Returns a hard verdict, or null if rules are inconclusive. */
function runRuleEngine(
  body: SubmitReportBody,
  existingReports: Array<{ featureType: string; userId?: string; createdAt?: Date | string }>,
  userId: string,
): ModerationResult | null {
  const description = body.description?.trim() ?? ''

  if (description && description.length < 8) {
    return {
      valid: false,
      verdict: 'flagged',
      reason: 'Description is too short to be useful.',
      confidence: 0.85,
    }
  }

  if (description && SPAM_PATTERNS.some((p) => p.test(description))) {
    return {
      valid: false,
      verdict: 'flagged',
      reason: 'Report appears to be spam or not about accessibility.',
      confidence: 0.92,
    }
  }

  if (description && NONSENSE_WORDS.has(description.toLowerCase())) {
    return {
      valid: false,
      verdict: 'flagged',
      reason: 'Report does not appear to describe an accessibility condition.',
      confidence: 0.9,
    }
  }

  if (description && looksLikeGibberish(description)) {
    return {
      valid: false,
      verdict: 'flagged',
      reason: 'Description looks like random characters rather than real text.',
      confidence: 0.87,
    }
  }

  if (description && isShoutingCaps(description)) {
    return {
      valid: false,
      verdict: 'flagged',
      reason: 'Please avoid writing the entire description in capital letters.',
      confidence: 0.75,
    }
  }

  if (isDuplicateForUser(existingReports, body.featureType, userId)) {
    return {
      valid: false,
      verdict: 'flagged',
      reason: 'You already submitted a report for this feature recently.',
      confidence: 0.88,
    }
  }

  return null
}

/**
 * Full moderation pipeline (no paid AI):
 *  Tier 1 — rule engine catches obvious spam/gibberish/duplicates for free.
 *  Tier 2 — trusted users (track record, no flags) auto-approve instantly.
 *  Tier 3 — everyone else goes live as "pending" and is confirmed or hidden
 *           by community votes/flags (see locationService.voteOnReport/flagReport).
 */
async function moderateReport(
  body: SubmitReportBody,
  existingReports: Array<{ featureType: string; userId?: string; createdAt?: Date | string }>,
  userId: string,
): Promise<ModerationResult> {
  const ruleVerdict = runRuleEngine(body, existingReports, userId)
  if (ruleVerdict) return ruleVerdict

  const trust = await getTrustStatus(userId)
  if (trust.autoApprove) {
    return {
      valid: true,
      verdict: 'approved',
      reason: 'Trusted contributor — auto-approved.',
      confidence: 0.97,
    }
  }

  return {
    valid: true,
    verdict: 'pending',
    reason: 'Visible now — awaiting community confirmation.',
    confidence: 0.6,
  }
}

const FEATURE_TYPES = new Set(['ramp', 'elevator', 'restroom', 'parking', 'pathway', 'signage'])
const REPORT_STATUSES = new Set(['accessible', 'partial', 'inaccessible'])

export function validateSubmitBody(body: unknown, userId: string): SubmitReportBody | string {
  if (!body || typeof body !== 'object') return 'Invalid request body.'

  const { locationId, featureType, status, description, photos } = body as Record<string, unknown>

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

  let validatedPhotos: string[] = []
  if (photos !== undefined) {
    if (!Array.isArray(photos) || photos.some((p) => typeof p !== 'string')) {
      return 'Photos must be a list of URLs.'
    }
    if (photos.length > MAX_PHOTOS_PER_REPORT) {
      return `A report can have at most ${MAX_PHOTOS_PER_REPORT} photos.`
    }
    // Defense in depth: each photo must belong to this user's upload folder.
    if (photos.some((p) => !isOwnCloudinaryUrlForUser(p, userId))) {
      return 'One or more photos are invalid.'
    }
    validatedPhotos = photos as string[]
  }

  return {
    locationId,
    featureType: featureType as FeatureType,
    status: status as SubmitReportBody['status'],
    description: typeof description === 'string' ? description.trim() : undefined,
    photos: validatedPhotos,
  }
}

export async function processReportSubmission(
  body: SubmitReportBody,
  userId: string,
): Promise<{ report: ReportOutput; moderation: ModerationResult } | { error: string }> {
  if (!(await locationExists(body.locationId))) {
    return { error: 'Location not found.' }
  }

  const existingReports = await getReportsForModeration(body.locationId)
  const moderation = await moderateReport(body, existingReports, userId)

  const created = await createReport(body.locationId, {
    userId,
    featureType: body.featureType,
    status: body.status as AccessibilityStatus,
    description: body.description || undefined,
    photos: body.photos ?? [],
    upvotes: 0,
    downvotes: 0,
    verified: false,
    aiVerdict: moderation.verdict,
    upvoterIds: [],
    downvoterIds: [],
    flaggerIds: [],
  })

  if (!created) {
    return { error: 'Failed to add report.' }
  }

  if (moderation.verdict !== 'flagged') {
    await recordReportContribution(userId, { verdict: moderation.verdict })
  }

  const authorMap = await getAuthorsByUids([userId])
  const author = authorMap.get(userId)
  const report = toFullReport(created, author) as ReportOutput

  return {
    report,
    moderation,
  }
}
