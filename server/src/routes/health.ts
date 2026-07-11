import { Router } from 'express'
import { isMongoConnected } from '../lib/db.js'
import { getQueueStats } from '../lib/jobQueue.js'
import { isRedisConfigured, redisPing } from '../lib/redis.js'

export const healthRouter = Router()

const startedAt = Date.now()

/** Fast liveness probe — no DB/Redis calls. Use for Render deploy health checks. */
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'accessmapph-api',
    uptimeSec: Math.floor(process.uptime()),
  })
})

healthRouter.head('/live', (_req, res) => {
  res.status(200).end()
})

healthRouter.get('/', async (_req, res) => {
  const mongoOk = isMongoConnected()
  const redisConfigured = isRedisConfigured()
  const redisOk = redisConfigured ? await redisPing() : null
  const jobQueue = await getQueueStats()

  const healthy = mongoOk && (redisOk === null || redisOk === true)

  const memory = process.memoryUsage()

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'accessmapph-api',
    version: '0.1.0',
    uptimeSec: Math.floor(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    checks: {
      mongodb: mongoOk ? 'ok' : 'down',
      redis: redisConfigured ? (redisOk ? 'ok' : 'down') : 'not_configured',
      jobQueue: {
        status: 'ok',
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
