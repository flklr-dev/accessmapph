export type FeedbackType = 'suggestion' | 'bug' | 'other'

export interface FeedbackSubmission {
  id: string
  type: FeedbackType
  message: string
  createdAt: string
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  suggestion: 'Suggestion',
  bug: 'Bug report',
  other: 'Other',
}

export const FEEDBACK_TYPE_OPTIONS: FeedbackType[] = ['suggestion', 'bug', 'other']

export const FEEDBACK_MESSAGE_MIN = 20
export const FEEDBACK_MESSAGE_MAX = 2000
