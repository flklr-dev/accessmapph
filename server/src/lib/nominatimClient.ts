import { getRedisClient } from './redis.js'

/** OSM Nominatim usage policy: max ~1 request/second per application. */
export const NOMINATIM_MIN_INTERVAL_MS = 1100
export const NOMINATIM_FETCH_TIMEOUT_MS = 8_000
export const NOMINATIM_REDIS_GATE_MS = 1100

export class NominatimTimeoutError extends Error {
  constructor() {
    super('NOMINATIM_TIMEOUT')
    this.name = 'NominatimTimeoutError'
  }
}

export class NominatimBusyError extends Error {
  constructor() {
    super('NOMINATIM_BUSY')
    this.name = 'NominatimBusyError'
  }
}

export function isNominatimTransientError(error: unknown): boolean {
  return error instanceof NominatimTimeoutError || error instanceof NominatimBusyError
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'AccessMapPH/0.1 (accessibility mapping; dev@accessmapph.local)',
  Accept: 'application/json',
}

let queueTail: Promise<void> = Promise.resolve()
let lastRequestAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Per-instance spacing so we never burst faster than 1 req/sec locally. */
async function waitForLocalSlot(): Promise<void> {
  const now = Date.now()
  const waitMs = Math.max(0, lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - now)
  if (waitMs > 0) await sleep(waitMs)
  lastRequestAt = Date.now()
}

/**
 * Cross-instance gate via Redis SET NX — only one API instance talks to
 * Nominatim at a time cluster-wide. No-op when Redis is unavailable.
 */
async function acquireGlobalGate(): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  const key = 'nominatim:gate'
  const maxAttempts = 40

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const acquired = await redis.set(key, '1', { NX: true, PX: NOMINATIM_REDIS_GATE_MS })
    if (acquired) return
    await sleep(80 + Math.floor(Math.random() * 40))
  }

  throw new NominatimBusyError()
}

/**
 * Serializes Nominatim traffic: in-process queue + optional Redis global gate.
 * All outbound Nominatim fetches must go through this.
 */
export function scheduleNominatimRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    await waitForLocalSlot()
    await acquireGlobalGate()
    return fn()
  }

  const result = queueTail.then(run, run)
  queueTail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

/**
 * Fetch JSON from Nominatim with timeout, throttling, and typed errors for
 * overload / slow responses (do not negative-cache those).
 */
export async function nominatimFetchJson<T>(url: string): Promise<T> {
  return scheduleNominatimRequest(async () => {
    let response: Response
    try {
      response = await fetch(url, {
        headers: NOMINATIM_HEADERS,
        signal: AbortSignal.timeout(NOMINATIM_FETCH_TIMEOUT_MS),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new NominatimTimeoutError()
      }
      throw new NominatimBusyError()
    }

    if (response.status === 429 || response.status >= 500) {
      throw new NominatimBusyError()
    }

    if (!response.ok) {
      throw new NominatimBusyError()
    }

    return (await response.json()) as T
  })
}
