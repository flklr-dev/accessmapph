import type { NextFunction, Response } from 'express'
import type { AuthenticatedRequest } from './auth.js'

interface WindowEntry {
  timestamps: number[]
}

/** In-memory sliding-window limiter (single-instance). Use Redis for multi-instance deploys. */
const windows = new Map<string, WindowEntry>()

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) windows.delete(key)
  }
}, CLEANUP_INTERVAL_MS).unref?.()

export function createRateLimiter(options: {
  /** Unique key prefix, e.g. "reports" */
  name: string
  /** Max requests in the window */
  max: number
  /** Window size in milliseconds */
  windowMs: number
  message?: string
}) {
  const { name, max, windowMs, message } = options

  return function rateLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void {
    const uid = req.auth?.uid
    if (!uid) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const key = `${name}:${uid}`
    const now = Date.now()
    const entry = windows.get(key) ?? { timestamps: [] }
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

    if (entry.timestamps.length >= max) {
      const retryAfterSec = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000)
      res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)))
      res.status(429).json({
        error: message ?? 'Too many requests. Please try again later.',
      })
      return
    }

    entry.timestamps.push(now)
    windows.set(key, entry)
    next()
  }
}

/** PRD: max 20 reports/hour per user */
export const reportRateLimit = createRateLimiter({
  name: 'reports',
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: 'Report limit reached (20 per hour). Please try again later.',
})

export const locationCreateRateLimit = createRateLimiter({
  name: 'locations',
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Location create limit reached (10 per hour). Please try again later.',
})
