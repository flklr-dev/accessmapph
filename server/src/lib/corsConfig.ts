import type { CorsOptions } from 'cors'
import type { Request, Response } from 'express'

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

function parseClientOrigins(): string[] {
  return (process.env.CLIENT_URL?.split(',') ?? [])
    .map(normalizeOrigin)
    .filter(Boolean)
}

function isVercelHost(hostname: string): boolean {
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app')
}

function isOriginAllowed(origin: string): boolean {
  const normalized = normalizeOrigin(origin)
  const allowed = new Set([...LOCAL_ORIGINS, ...parseClientOrigins()])

  if (allowed.has(normalized)) return true

  // Production Vercel deploys — avoids broken auth when CLIENT_URL is misconfigured.
  if (process.env.NODE_ENV === 'production') {
    try {
      if (isVercelHost(new URL(origin).hostname)) return true
    } catch {
      // invalid origin
    }
  }

  return false
}

export function buildCorsOptions(): CorsOptions {
  const clientOrigins = parseClientOrigins()

  if (process.env.NODE_ENV === 'production' && clientOrigins.length === 0) {
    console.warn(
      '[cors] CLIENT_URL is not set — allowing *.vercel.app in production. ' +
        'Set CLIENT_URL for custom domains.',
    )
  } else if (clientOrigins.length > 0) {
    console.log(`[cors] CLIENT_URL origins: ${clientOrigins.join(', ')}`)
  }

  return {
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true)
        return
      }
      console.warn(`[cors] blocked origin: ${origin}`)
      callback(null, false)
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  }
}

/** Ensure error responses still include CORS headers for browser clients. */
export function applyCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin
  if (typeof origin === 'string' && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
}
