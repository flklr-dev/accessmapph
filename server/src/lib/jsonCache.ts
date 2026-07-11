import type { RedisClientType } from 'redis'

interface MemoryEntry {
  value: string
  expiresAt: number
}

export interface JsonCache {
  /** `undefined` = miss; otherwise parsed JSON (may be `null`). */
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}

class MemoryJsonCache implements JsonCache {
  private readonly entries = new Map<string, MemoryEntry>()
  private readonly maxEntries: number

  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      return undefined
    }
    return JSON.parse(entry.value) as T
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey) this.entries.delete(oldestKey)
    }
    this.entries.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlMs,
    })
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key)
  }
}

class RedisJsonCache implements JsonCache {
  private readonly fallback: MemoryJsonCache
  private readonly prefix: string

  constructor(
    private readonly redis: RedisClientType,
    options?: { prefix?: string; memoryFallbackMax?: number },
  ) {
    this.prefix = options?.prefix ?? 'cache:'
    this.fallback = new MemoryJsonCache(options?.memoryFallbackMax ?? 200)
  }

  private redisKey(key: string): string {
    return `${this.prefix}${key}`
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(this.redisKey(key))
      if (raw === null) return undefined
      return JSON.parse(raw) as T
    } catch (err) {
      console.warn('[cache] Redis get failed, using in-memory fallback:', err)
      return this.fallback.get<T>(key)
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000))
    try {
      await this.redis.set(this.redisKey(key), JSON.stringify(value), { EX: ttlSec })
    } catch (err) {
      console.warn('[cache] Redis set failed, using in-memory fallback:', err)
      await this.fallback.set(key, value, ttlMs)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.redisKey(key))
    } catch {
      // ignore — best-effort invalidation
    }
    await this.fallback.delete(key)
  }
}

let geocodeCache: JsonCache = new MemoryJsonCache()
let authSessionCache: JsonCache = new MemoryJsonCache(500)

function createCache(redis: RedisClientType | null, prefix: string, memoryMax: number): JsonCache {
  return redis
    ? new RedisJsonCache(redis, { prefix, memoryFallbackMax: memoryMax })
    : new MemoryJsonCache(memoryMax)
}

export function initGeocodeCache(redis: RedisClientType | null): void {
  geocodeCache = createCache(redis, 'geocode:', 2000)
}

export function initAuthSessionCache(redis: RedisClientType | null): void {
  authSessionCache = createCache(redis, 'auth:', 500)
}

export function getGeocodeCache(): JsonCache {
  return geocodeCache
}

export function getAuthSessionCache(): JsonCache {
  return authSessionCache
}
