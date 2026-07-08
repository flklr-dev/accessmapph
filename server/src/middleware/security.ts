import helmet from 'helmet'
import type { RequestHandler } from 'express'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Security headers for the JSON API.
 * CSP is relaxed for API responses (no HTML); the SPA sets its own CSP in index.html.
 */
export const securityHeaders: RequestHandler[] = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
]
