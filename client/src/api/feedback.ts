import { apiFetch } from './http'
import type { FeedbackSubmission, FeedbackType } from '../types/feedback'

export interface SubmitFeedbackInput {
  type: FeedbackType
  message: string
  pageUrl?: string
  userAgent?: string
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<FeedbackSubmission> {
  const data = await apiFetch<{ feedback: FeedbackSubmission }>('/api/feedback', {
    method: 'POST',
    body: input,
    auth: true,
  })
  return data.feedback
}
