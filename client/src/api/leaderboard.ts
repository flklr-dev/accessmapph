import { apiFetch } from './http'
import type { LeaderboardCity, LeaderboardResult } from '../types/leaderboard'

export async function fetchLeaderboard(
  city: LeaderboardCity = 'all',
  limit = 25,
): Promise<LeaderboardResult> {
  const params = new URLSearchParams({
    city,
    limit: String(limit),
  })
  return apiFetch<LeaderboardResult>(`/api/leaderboard?${params}`, { auth: false })
}
