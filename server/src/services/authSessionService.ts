import { createHash } from 'node:crypto'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { verifyIdToken } from '../lib/firebase.js'
import { getAuthSessionCache } from '../lib/jsonCache.js'
import type { IUser } from '../models/User.js'
import {
  getUserByFirebaseUid,
  syncUserFromToken,
  type AuthIdentity,
} from './userService.js'

export interface ResolvedAuth {
  auth: AuthIdentity
  user: IUser
  emailVerified: boolean
  signInProvider: string
}

interface CachedAuthSession {
  uid: string
  email: string
  emailVerified: boolean
  signInProvider: string
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000
const MIN_CACHE_TTL_MS = 60 * 1000

function tokenCacheKey(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Cap cache TTL at 5 min and never past token expiry. */
function cacheTtlMs(decoded: DecodedIdToken): number {
  const nowSec = Math.floor(Date.now() / 1000)
  const exp = typeof decoded.exp === 'number' ? decoded.exp : nowSec + 3600
  const untilExpMs = (exp - nowSec - 30) * 1000
  return Math.max(MIN_CACHE_TTL_MS, Math.min(DEFAULT_CACHE_TTL_MS, untilExpMs))
}

function sessionFromDecoded(decoded: DecodedIdToken): CachedAuthSession {
  return {
    uid: decoded.uid,
    email: decoded.email!,
    emailVerified: decoded.email_verified === true,
    signInProvider: decoded.firebase?.sign_in_provider ?? 'unknown',
  }
}

/**
 * Resolve a Bearer token to auth identity + Mongo user.
 *
 * Hot path (cache hit): one Redis read + one Mongo find — skips Firebase
 * verify and profile upsert. Cold path: verify with revocation check, sync
 * profile only when fields changed, then cache for subsequent requests.
 */
export async function resolveAuthFromToken(token: string): Promise<ResolvedAuth> {
  const cache = getAuthSessionCache()
  const cacheKey = tokenCacheKey(token)

  const cached = await cache.get<CachedAuthSession>(cacheKey)
  if (cached) {
    const user = await getUserByFirebaseUid(cached.uid)
    if (user) {
      return {
        auth: {
          uid: cached.uid,
          email: cached.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        user,
        emailVerified: cached.emailVerified,
        signInProvider: cached.signInProvider,
      }
    }
    await cache.delete(cacheKey)
  }

  const decoded = await verifyIdToken(token)
  if (!decoded.email) {
    throw new Error('EMAIL_REQUIRED')
  }

  const user = await syncUserFromToken(decoded)
  await cache.set(cacheKey, sessionFromDecoded(decoded), cacheTtlMs(decoded))

  return {
    auth: {
      uid: decoded.uid,
      email: decoded.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    },
    user,
    emailVerified: decoded.email_verified === true,
    signInProvider: decoded.firebase?.sign_in_provider ?? 'unknown',
  }
}
