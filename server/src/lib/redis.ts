import { createClient, type RedisClientType } from 'redis'

let client: RedisClientType | null = null
let connected = false

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

/**
 * Upstash (and most hosted Redis) requires TLS. Users often paste the
 * non-TLS `redis://` URL from the dashboard — upgrade it automatically.
 */
function normalizeRedisUrl(raw: string): string {
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()

    if (
      (host.endsWith('.upstash.io') || host.includes('upstash')) &&
      parsed.protocol === 'redis:'
    ) {
      parsed.protocol = 'rediss:'
      return parsed.toString()
    }
  } catch {
    // keep original if not a valid URL
  }
  return raw
}

function usesTls(url: string): boolean {
  return url.startsWith('rediss://')
}

/**
 * Connect to Redis when REDIS_URL is set. Returns null when unset or on
 * connection failure — callers fall back to in-memory stores so local dev
 * keeps working without Redis.
 */
export async function initRedis(): Promise<RedisClientType | null> {
  const rawUrl = process.env.REDIS_URL?.trim()
  if (!rawUrl) {
    console.log(
      '[redis] REDIS_URL not set — rate limits and geocode cache use in-memory fallback (single instance only)',
    )
    return null
  }

  const url = normalizeRedisUrl(rawUrl)
  if (url !== rawUrl) {
    console.log('[redis] upgraded URL to TLS (rediss://) for hosted Redis')
  }

  const next = createClient({
    url,
    socket: {
      ...(usesTls(url) ? { tls: true } : {}),
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => {
        // After initial connect failure we disconnect — no endless retry spam.
        if (!connected) return false
        if (retries > 5) return false
        return Math.min(retries * 200, 2_000)
      },
    },
  })

  let loggedError = false
  next.on('error', (err) => {
    if (!loggedError) {
      console.error('[redis] client error:', err.message)
      loggedError = true
    }
  })

  try {
    await next.connect()
    await next.ping()
    client = next
    connected = true
    console.log('[redis] connected — shared rate limits and geocode cache enabled')
    return client
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[redis] connection failed — using in-memory fallback. ` +
        `For Upstash, use the "Redis URL" with rediss:// (TLS), not redis://. Error: ${message}`,
    )
    try {
      next.disconnect()
    } catch {
      // ignore
    }
    client = null
    connected = false
    return null
  }
}

export function getRedisClient(): RedisClientType | null {
  return connected && client ? client : null
}

export async function redisPing(): Promise<boolean> {
  const c = getRedisClient()
  if (!c) return false
  try {
    return (await c.ping()) === 'PONG'
  } catch {
    return false
  }
}

export async function closeRedis(): Promise<void> {
  if (!client) return
  try {
    await client.quit()
  } catch {
    // ignore shutdown errors
  } finally {
    client = null
    connected = false
  }
}
