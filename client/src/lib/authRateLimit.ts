/** Client-side sliding-window limiter for auth attempts (UX + abuse cushion). */

interface WindowEntry {
  timestamps: number[]
}

const windows = new Map<string, WindowEntry>()

const LIMITS = {
  email: { max: 5, windowMs: 60_000 },
  google: { max: 3, windowMs: 60_000 },
} as const

export type AuthRateLimitKind = keyof typeof LIMITS

export function checkAuthRateLimit(
  kind: AuthRateLimitKind,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const { max, windowMs } = LIMITS[kind]
  const now = Date.now()
  const entry = windows.get(kind) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= max) {
    const retryAfterSec = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000)
    windows.set(kind, entry)
    return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) }
  }

  entry.timestamps.push(now)
  windows.set(kind, entry)
  return { allowed: true }
}
