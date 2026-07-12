import { Feedback, type FeedbackJSON, type FeedbackType } from '../models/Feedback.js'
import type { IUser } from '../models/User.js'

export const FEEDBACK_MESSAGE_MIN = 20
export const FEEDBACK_MESSAGE_MAX = 2000

const FEEDBACK_TYPES: FeedbackType[] = ['suggestion', 'bug', 'other']

export interface SubmitFeedbackInput {
  type: FeedbackType
  message: string
  pageUrl?: string | null
  userAgent?: string | null
}

function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === 'string' && FEEDBACK_TYPES.includes(value as FeedbackType)
}

function trimOptionalString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

export function validateSubmitFeedbackBody(
  body: unknown,
): SubmitFeedbackInput | string {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body.'
  }

  const { type, message, pageUrl, userAgent } = body as Record<string, unknown>

  if (!isFeedbackType(type)) {
    return 'type must be "suggestion", "bug", or "other".'
  }

  if (typeof message !== 'string') {
    return 'message is required.'
  }

  const trimmedMessage = message.trim()
  if (trimmedMessage.length < FEEDBACK_MESSAGE_MIN) {
    return `message must be at least ${FEEDBACK_MESSAGE_MIN} characters.`
  }
  if (trimmedMessage.length > FEEDBACK_MESSAGE_MAX) {
    return `message must be at most ${FEEDBACK_MESSAGE_MAX} characters.`
  }

  return {
    type,
    message: trimmedMessage,
    pageUrl: trimOptionalString(pageUrl, 500),
    userAgent: trimOptionalString(userAgent, 500),
  }
}

export async function createFeedback(
  user: IUser,
  input: SubmitFeedbackInput,
): Promise<FeedbackJSON> {
  const doc = await Feedback.create({
    userId: user.firebaseUid,
    userEmail: user.email,
    userName: user.displayName,
    type: input.type,
    message: input.message,
    pageUrl: input.pageUrl ?? null,
    userAgent: input.userAgent ?? null,
    read: false,
  })

  return {
    id: doc._id.toString(),
    type: doc.type,
    message: doc.message,
    createdAt: doc.createdAt.toISOString(),
  }
}
