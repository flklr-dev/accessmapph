import type { UserLevel } from './auth'

export type LeaderboardCity = 'all' | 'manila' | 'cebu' | 'davao'

export interface LeaderboardEntry {
  rank: number
  id: string
  displayName: string
  photoURL: string | null
  points: number
  level: UserLevel
  reportCount: number
  cityReports: number
}

export interface LeaderboardResult {
  city: LeaderboardCity
  cityLabel: string
  entries: LeaderboardEntry[]
  totalContributors: number
}

export const LEADERBOARD_CITY_OPTIONS: {
  id: LeaderboardCity
  label: string
}[] = [
  { id: 'all', label: 'All PH' },
  { id: 'manila', label: 'Manila' },
  { id: 'cebu', label: 'Cebu' },
  { id: 'davao', label: 'Davao' },
]
