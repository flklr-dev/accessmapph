import { randomUUID } from 'node:crypto'
import type { RedisClientType } from 'redis'

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the oldest request in the window expires (when blocked). */
  retryAfterSec?: number
}

export interface SlidingWindowStore {
  consume(key: string, max: number, windowMs: number): Promise<RateLimitResult>
}

interface MemoryEntry {
  timestamps: number[]
}

/** Process-local sliding window — used when Redis is unavailable. */
class MemorySlidingWindowStore implements SlidingWindowStore {
  private readonly windows = new Map<string, MemoryEntry>()

  constructor() {
    const cleanupMs = 10 * 60 * 1000
    setInterval(() => {
      const cutoff = Date.now() - 60 * 60 * 1000
      for (const [key, entry] of this.windows) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
        if (entry.timestamps.length === 0) this.windows.delete(key)
      }
    }, cleanupMs).unref?.()
  }

  async consume(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const entry = this.windows.get(key) ?? { timestamps: [] }
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

    if (entry.timestamps.length >= max) {
      const oldest = entry.timestamps[0] ?? now
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
      return { allowed: false, retryAfterSec }
    }

    entry.timestamps.push(now)
    this.windows.set(key, entry)
    return { allowed: true }
  }
}

/**
 * Redis sorted-set sliding window. Atomic via Lua so concurrent requests
 * across multiple API instances share one accurate counter per key.
 */
class RedisSlidingWindowStore implements SlidingWindowStore {
  private readonly fallback = new MemorySlidingWindowStore()
  private readonly scriptSha: Promise<string>

  constructor(private readonly redis: RedisClientType) {
    this.scriptSha = this.redis.scriptLoad(SLIDING_WINDOW_LUA)
  }

  async consume(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const redisKey = `rl:${key}`
    const member = `${now}:${randomUUID()}`

    try {
      const sha = await this.scriptSha
      const raw = (await this.redis.evalSha(sha, {
        keys: [redisKey],
        arguments: [String(now), String(windowMs), String(max), member],
      })) as [number, number]

      const allowed = raw[0] === 1
      if (allowed) return { allowed: true }

      const retryAfterSec = Math.max(1, Math.ceil(raw[1] / 1000))
      return { allowed: false, retryAfterSec }
    } catch (err) {
      console.warn('[rate-limit] Redis error, falling back to in-memory for this request:', err)
      return this.fallback.consume(key, max, windowMs)
    }
  }
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryMs = window
  if oldest[2] then
    retryMs = tonumber(oldest[2]) + window - now
  end
  return {0, retryMs}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0}
`

let store: SlidingWindowStore = new MemorySlidingWindowStore()

export function initSlidingWindowStore(redis: RedisClientType | null): void {
  store = redis ? new RedisSlidingWindowStore(redis) : new MemorySlidingWindowStore()
}

export function getSlidingWindowStore(): SlidingWindowStore {
  return store
}
