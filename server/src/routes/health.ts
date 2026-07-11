import { Router } from 'express'
import { isMongoConnected } from '../lib/db.js'
import { getQueueStats } from '../lib/jobQueue.js'
import { isRedisConfigured, redisPing } from '../lib/redis.js'

export const healthRouter = Router()

const startedAt = Date.now()

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

/** Render deploy probe — always 200, no external calls, must respond in <5s. */
export function sendLiveness(res: { status: (code: number) => { json: (body: unknown) => void; end: () => void } }) {
  res.status(200).json({
    status: 'ok',
    service: 'accessmapph-api',
    uptimeSec: Math.floor(process.uptime()),
  })
}

export function sendLivenessHead(res: { status: (code: number) => { end: () => void } }) {
  res.status(200).end()
}

healthRouter.get('/live', (_req, res) => {
  sendLiveness(res)
})

healthRouter.head('/live', (_req, res) => {
  sendLivenessHead(res)
})

healthRouter.get('/', async (_req, res) => {
  const mongoOk = isMongoConnected()
  const redisConfigured = isRedisConfigured()
  const redisOk = redisConfigured
    ? await withTimeout(redisPing(), 2_000, false)
    : null
  const jobQueue = await withTimeout(getQueueStats(), 2_000, { pending: -1, backend: 'redis' as const })

  const healthy = mongoOk && (redisOk === null || redisOk === true)
  const memory = process.memoryUsage()

  // Always 200 so Render deploy health checks pass; use `status` for monitoring.
  res.status(200).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'accessmapph-api',
    version: '0.1.0',
    uptimeSec: Math.floor(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    checks: {
      mongodb: mongoOk ? 'ok' : 'down',
      redis: redisConfigured ? (redisOk ? 'ok' : 'down') : 'not_configured',
      jobQueue: {
        status: jobQueue.pending >= 0 ? 'ok' : 'unknown',
        pending: jobQueue.pending,
        backend: jobQueue.backend,
      },
    },
    memoryMb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    },
  })
})

healthRouter.head('/', (_req, res) => {
  sendLivenessHead(res)
})
