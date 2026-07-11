import { createHash } from 'node:crypto'
import type { Request, Response, RequestHandler } from 'express'

export interface CacheOptions {
  scope?: 'public' | 'private'
  maxAge: number
  staleWhileRevalidate?: number
}

/** Default for mutating routes and private/auth responses. */
export function noStore(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  }
}

/** Set Cache-Control on semi-static GET routes (overrides global no-store). */
export function cacheControl(options: CacheOptions): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Cache-Control', formatCacheControl(options))
    next()
  }
}

function formatCacheControl(options: CacheOptions): string {
  const scope = options.scope ?? 'public'
  let header = `${scope}, max-age=${options.maxAge}`
  if (options.staleWhileRevalidate !== undefined) {
    header += `, stale-while-revalidate=${options.staleWhileRevalidate}`
  }
  return header
}

function weakEtagFromPayload(payload: string): string {
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16)
  return `W/"${hash}"`
}

function ifNoneMatchMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false
  return header.split(',').some((part) => part.trim() === etag)
}

/**
 * Send a cacheable public JSON response with ETag support (304 Not Modified).
 * Use for read-heavy endpoints where clients/CDNs can reuse responses.
 */
export function sendPublicCachedJson(
  req: Request,
  res: Response,
  body: unknown,
  options: CacheOptions,
): void {
  const payload = JSON.stringify(body)
  const etag = weakEtagFromPayload(payload)
  const cacheHeader = formatCacheControl(options)

  res.setHeader('Cache-Control', cacheHeader)
  res.setHeader('ETag', etag)

  if (ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
    res.status(304).end()
    return
  }

  res.type('application/json').send(payload)
}
