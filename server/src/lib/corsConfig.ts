import type { CorsOptions } from 'cors'

const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

function parseClientOrigins(): string[] {
  return (process.env.CLIENT_URL?.split(',') ?? [])
    .map(normalizeOrigin)
    .filter(Boolean)
}

function isVercelPreview(hostname: string): boolean {
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app')
}

/** Allow all *.vercel.app when any configured CLIENT_URL is on Vercel (preview deploys). */
function allowVercelPreviews(clientOrigins: string[]): boolean {
  return clientOrigins.some((origin) => {
    try {
      return isVercelPreview(new URL(origin).hostname)
    } catch {
      return false
    }
  })
}

export function buildCorsOptions(): CorsOptions {
  const clientOrigins = parseClientOrigins()
  const allowed = new Set([...LOCAL_ORIGINS, ...clientOrigins])
  const vercelPreviews = allowVercelPreviews(clientOrigins)

  if (process.env.NODE_ENV === 'production' && clientOrigins.length === 0) {
    console.warn(
      '[cors] CLIENT_URL is not set — browser requests from Vercel will be blocked. ' +
        'Set CLIENT_URL=https://accessmapph.vercel.app on Render and redeploy.',
    )
  } else if (clientOrigins.length > 0) {
    console.log(`[cors] allowed origins: ${[...allowed].join(', ')}${vercelPreviews ? ' (+ *.vercel.app previews)' : ''}`)
  }

  return {
    origin(origin, callback) {
      // curl, server-to-server, same-origin
      if (!origin) {
        callback(null, true)
        return
      }

      const normalized = normalizeOrigin(origin)
      if (allowed.has(normalized)) {
        callback(null, true)
        return
      }

      if (vercelPreviews) {
        try {
          if (isVercelPreview(new URL(origin).hostname)) {
            callback(null, true)
            return
          }
        } catch {
          // invalid origin URL
        }
      }

      console.warn(`[cors] blocked origin: ${origin}`)
      callback(null, false)
    },
  }
}
