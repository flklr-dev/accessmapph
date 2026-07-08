import type { NextFunction, Request, Response } from 'express'
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

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function applyRateLimit(
  key: string,
  max: number,
  windowMs: number,
  res: Response,
  message?: string,
): boolean {
  const now = Date.now()
  const entry = windows.get(key) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= max) {
    const retryAfterSec = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000)
    res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)))
    res.status(429).json({
      error: message ?? 'Too many requests. Please try again later.',
    })
    return false
  }

  entry.timestamps.push(now)
  windows.set(key, entry)
  return true
}

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
    if (!applyRateLimit(key, max, windowMs, res, message)) return
    next()
  }
}

/** IP-based limiter for unauthenticated public endpoints. */
export function createIpRateLimiter(options: {
  name: string
  max: number
  windowMs: number
  message?: string
}) {
  const { name, max, windowMs, message } = options

  return function ipRateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = `${name}:ip:${clientIp(req)}`
    if (!applyRateLimit(key, max, windowMs, res, message)) return
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

/** Community moderation actions (votes/flags) — generous, but still capped against abuse. */
export const reportActionRateLimit = createRateLimiter({
  name: 'report-actions',
  max: 60,
  windowMs: 60 * 60 * 1000,
  message: 'Too many actions. Please try again later.',
})

/** Photo upload signing/confirmation — up to ~3 photos per report, generous headroom for retries. */
export const uploadRateLimit = createRateLimiter({
  name: 'uploads',
  max: 40,
  windowMs: 60 * 60 * 1000,
  message: 'Too many photo uploads. Please try again later.',
})

/** Account deletion — strict cap to prevent abuse. */
export const accountDeleteRateLimit = createRateLimiter({
  name: 'account-delete',
  max: 3,
  windowMs: 60 * 60 * 1000,
  message: 'Too many deletion attempts. Please try again later.',
})

/** Public geocoding search — per IP */
export const geocodeSearchRateLimit = createIpRateLimiter({
  name: 'geocode-search',
  max: 30,
  windowMs: 60 * 60 * 1000,
  message: 'Too many search requests. Please try again later.',
})

/** Public coordinate resolve — per IP (each call may hit Nominatim) */
export const geocodeResolveRateLimit = createIpRateLimiter({
  name: 'geocode-resolve',
  max: 60,
  windowMs: 60 * 60 * 1000,
  message: 'Too many location lookups. Please try again later.',
})
