import type { NextFunction, Request, Response } from 'express'
import { applyCorsHeaders } from '../lib/corsConfig.js'
import { isFirebaseReady } from '../lib/firebase.js'
import { resolveAuthFromToken } from '../services/authSessionService.js'
import type { AuthIdentity } from '../services/userService.js'
import type { IUser } from '../models/User.js'

export interface AuthenticatedRequest extends Request {
  auth?: AuthIdentity
  user?: IUser
  emailVerified?: boolean
  signInProvider?: string
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

/**
 * Requires a valid Firebase ID token.
 * Attaches `req.auth` and `req.user`. Allows unverified email/password users
 * so the client can show a verify-email state.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isFirebaseReady()) {
      applyCorsHeaders(req, res)
      res.status(503).json({ error: 'Authentication is not configured on the server.' })
      return
    }

    const token = extractBearerToken(req.headers.authorization)
    if (!token) {
      applyCorsHeaders(req, res)
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const resolved = await resolveAuthFromToken(token)

    req.auth = resolved.auth
    req.user = resolved.user
    req.emailVerified = resolved.emailVerified
    req.signInProvider = resolved.signInProvider
    next()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    applyCorsHeaders(req, res)
    if (message === 'EMAIL_REQUIRED') {
      res.status(403).json({ error: 'A verified email is required.' })
      return
    }
    if (message === 'AUTH_NOT_CONFIGURED') {
      res.status(503).json({ error: 'Authentication is not configured on the server.' })
      return
    }
    console.error('[auth] Token verification failed:', message)
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' })
  }
}

/** Blocks email/password accounts that have not verified their email. */
export function requireVerifiedEmail(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.signInProvider === 'password' && req.emailVerified === false) {
    res.status(403).json({
      error: 'Verify your email before contributing. Check your inbox and spam folder.',
      code: 'EMAIL_NOT_VERIFIED',
    })
    return
  }
  next()
}
