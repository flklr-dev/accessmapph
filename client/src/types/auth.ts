import type { AccessibilityStatus, AIVerdict, FeatureType } from './index'

export type UserLevel = 'newcomer' | 'contributor' | 'trusted' | 'champion'

export interface AppUser {
  id: string
  email: string
  displayName: string
  photoURL: string | null
  points: number
  level: UserLevel
  city: string | null
  reportCount: number
  createdAt: string
}

export interface UserContribution {
  id: string
  locationId: string
  locationName: string
  locationCity: string
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

export const LEVEL_LABELS: Record<UserLevel, string> = {
  newcomer: 'Newcomer',
  contributor: 'Contributor',
  trusted: 'Trusted',
  champion: 'Champion',
}

/** Points needed to reach each level (inclusive). */
export const LEVEL_THRESHOLDS: Record<UserLevel, number> = {
  newcomer: 0,
  contributor: 50,
  trusted: 200,
  champion: 500,
}

export function nextLevelInfo(points: number, level: UserLevel): {
  next: UserLevel | null
  progress: number
  pointsToNext: number
} {
  const order: UserLevel[] = ['newcomer', 'contributor', 'trusted', 'champion']
  const idx = order.indexOf(level)
  if (idx < 0 || idx === order.length - 1) {
    return { next: null, progress: 1, pointsToNext: 0 }
  }
  const next = order[idx + 1]
  const currentFloor = LEVEL_THRESHOLDS[level]
  const nextFloor = LEVEL_THRESHOLDS[next]
  const span = nextFloor - currentFloor
  const progress = Math.min(1, Math.max(0, (points - currentFloor) / span))
  return { next, progress, pointsToNext: Math.max(0, nextFloor - points) }
}
