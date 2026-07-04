import type { NextFunction, Request, Response } from 'express'
import { isFirebaseReady, verifyIdToken } from '../lib/firebase.js'
import { upsertUserFromToken, type AuthIdentity } from '../services/userService.js'
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
      res.status(503).json({ error: 'Authentication is not configured on the server.' })
      return
    }

    const token = extractBearerToken(req.headers.authorization)
    if (!token) {
      res.status(401).json({ error: 'Sign in required.' })
      return
    }

    const decoded = await verifyIdToken(token)

    if (!decoded.email) {
      res.status(403).json({ error: 'A verified email is required.' })
      return
    }

    const user = await upsertUserFromToken(decoded)

    req.auth = {
      uid: decoded.uid,
      email: decoded.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    }
    req.user = user
    req.emailVerified = decoded.email_verified === true
    req.signInProvider = decoded.firebase?.sign_in_provider ?? 'unknown'
    next()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
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
