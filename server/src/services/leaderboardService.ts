import { Location } from '../models/Location.js'
import { User, type UserLevel } from '../models/User.js'
import { toPublicFirstName } from '../lib/displayName.js'

export type LeaderboardCity = 'all' | 'manila' | 'cebu' | 'davao'

export interface LeaderboardEntry {
  rank: number
  id: string
  displayName: string
  photoURL: string | null
  points: number
  level: UserLevel
  reportCount: number
  /** Reports counted for the selected city scope (equals reportCount when city=all). */
  cityReports: number
}

export interface LeaderboardResult {
  city: LeaderboardCity
  cityLabel: string
  entries: LeaderboardEntry[]
  totalContributors: number
}

const CITY_LABELS: Record<LeaderboardCity, string> = {
  all: 'All Philippines',
  manila: 'Metro Manila',
  cebu: 'Cebu',
  davao: 'Davao',
}

/** Match location.city values used in seed data and Nominatim results. */
const CITY_PATTERNS: Record<Exclude<LeaderboardCity, 'all'>, RegExp> = {
  manila: /manila/i,
  cebu: /cebu/i,
  davao: /davao/i,
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

export function parseLeaderboardCity(value: unknown): LeaderboardCity {
  if (value === 'manila' || value === 'cebu' || value === 'davao' || value === 'all') {
    return value
  }
  return 'all'
}

export function parseLeaderboardLimit(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(Math.floor(n), MAX_LIMIT)
}

/**
 * Public leaderboard.
 *
 * - `all`: top contributors by lifetime points (users with at least one report).
 * - city: ranks users by non-flagged reports they authored at locations in that city,
 *   then by lifetime points as a tiebreaker. This reflects real local contribution
 *   even when a user's profile city is unset.
 */
export async function getLeaderboard(
  city: LeaderboardCity,
  limit = DEFAULT_LIMIT,
): Promise<LeaderboardResult> {
  if (city === 'all') {
    return getNationalLeaderboard(limit)
  }
  return getCityLeaderboard(city, limit)
}

async function getNationalLeaderboard(limit: number): Promise<LeaderboardResult> {
  const [users, totalContributors] = await Promise.all([
    User.find({ reportCount: { $gt: 0 } })
      .sort({ points: -1, reportCount: -1, createdAt: 1 })
      .limit(limit)
      .select('displayName photoURL points level reportCount')
      .lean(),
    User.countDocuments({ reportCount: { $gt: 0 } }),
  ])

  const entries: LeaderboardEntry[] = users.map((user, index) => ({
    rank: index + 1,
    id: user._id.toString(),
    displayName: toPublicFirstName(user.displayName),
    photoURL: user.photoURL ?? null,
    points: user.points ?? 0,
    level: user.level,
    reportCount: user.reportCount ?? 0,
    cityReports: user.reportCount ?? 0,
  }))

  return {
    city: 'all',
    cityLabel: CITY_LABELS.all,
    entries,
    totalContributors,
  }
}

async function getCityLeaderboard(
  city: Exclude<LeaderboardCity, 'all'>,
  limit: number,
): Promise<LeaderboardResult> {
  const pattern = CITY_PATTERNS[city]
  const locations = await Location.find(
    { city: pattern },
    { reports: 1 },
  ).lean()

  const reportCounts = new Map<string, number>()

  for (const loc of locations) {
    for (const report of loc.reports ?? []) {
      if (!report.userId) continue
      if (report.aiVerdict === 'flagged') continue
      reportCounts.set(report.userId, (reportCounts.get(report.userId) ?? 0) + 1)
    }
  }

  const uids = [...reportCounts.keys()]
  if (uids.length === 0) {
    return {
      city,
      cityLabel: CITY_LABELS[city],
      entries: [],
      totalContributors: 0,
    }
  }

  const users = await User.find({ firebaseUid: { $in: uids } })
    .select('firebaseUid displayName photoURL points level reportCount')
    .lean()

  const ranked = users
    .map((user) => ({
      id: user._id.toString(),
      fullName: user.displayName,
      photoURL: user.photoURL ?? null,
      points: user.points ?? 0,
      level: user.level,
      reportCount: user.reportCount ?? 0,
      cityReports: reportCounts.get(user.firebaseUid) ?? 0,
    }))
    .filter((entry) => entry.cityReports > 0)
    .sort((a, b) => {
      if (b.cityReports !== a.cityReports) return b.cityReports - a.cityReports
      if (b.points !== a.points) return b.points - a.points
      return a.fullName.localeCompare(b.fullName)
    })

  const entries: LeaderboardEntry[] = ranked.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    id: entry.id,
    displayName: toPublicFirstName(entry.fullName),
    photoURL: entry.photoURL,
    points: entry.points,
    level: entry.level,
    reportCount: entry.reportCount,
    cityReports: entry.cityReports,
  }))

  return {
    city,
    cityLabel: CITY_LABELS[city],
    entries,
    totalContributors: ranked.length,
  }
}
