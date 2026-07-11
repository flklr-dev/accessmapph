import type { NextFunction, Request, Response } from 'express'
import type { AuthenticatedRequest } from './auth.js'
import { getSlidingWindowStore } from '../lib/slidingWindowStore.js'

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

async function applyRateLimit(
  key: string,
  max: number,
  windowMs: number,
  res: Response,
  message?: string,
): Promise<boolean> {
  const result = await getSlidingWindowStore().consume(key, max, windowMs)

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec ?? 1))
    res.status(429).json({
      error: message ?? 'Too many requests. Please try again later.',
    })
    return false
  }

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

  return async function rateLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const uid = req.auth?.uid
    if (!uid) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const key = `${name}:${uid}`
    if (!(await applyRateLimit(key, max, windowMs, res, message))) return
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

  return async function ipRateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const key = `${name}:ip:${clientIp(req)}`
    if (!(await applyRateLimit(key, max, windowMs, res, message))) return
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

const ONE_MINUTE_MS = 60 * 1000

/** Map pin list — DB read; cap scrapers and runaway client refetches. */
export const locationPinsReadRateLimit = createIpRateLimiter({
  name: 'read-location-pins',
  max: 60,
  windowMs: ONE_MINUTE_MS,
  message: 'Too many map data requests. Please slow down.',
})

/** Single location detail — heavier payload (full reports). */
export const locationDetailReadRateLimit = createIpRateLimiter({
  name: 'read-location-detail',
  max: 120,
  windowMs: ONE_MINUTE_MS,
  message: 'Too many location requests. Please slow down.',
})

/** Leaderboard aggregation — public read. */
export const leaderboardReadRateLimit = createIpRateLimiter({
  name: 'read-leaderboard',
  max: 30,
  windowMs: ONE_MINUTE_MS,
  message: 'Too many leaderboard requests. Please try again shortly.',
})

/** Signed-in profile — light read, generous cap. */
export const profileReadRateLimit = createRateLimiter({
  name: 'read-profile',
  max: 60,
  windowMs: ONE_MINUTE_MS,
  message: 'Too many profile requests. Please slow down.',
})

/** Contribution history — joins reports + locations per user. */
export const contributionsReadRateLimit = createRateLimiter({
  name: 'read-contributions',
  max: 30,
  windowMs: ONE_MINUTE_MS,
  message: 'Too many requests. Please try again shortly.',
})
