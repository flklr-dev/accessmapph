import { Router } from 'express'
import mongoose from 'mongoose'
import { isRedisConfigured, redisPing } from '../lib/redis.js'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1
  const redisConfigured = isRedisConfigured()
  const redisOk = redisConfigured ? await redisPing() : null

  const healthy = mongoOk && (redisOk === null || redisOk === true)

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'accessmapph-api',
    version: '0.1.0',
    checks: {
      mongodb: mongoOk ? 'ok' : 'down',
      redis: redisConfigured ? (redisOk ? 'ok' : 'down') : 'not_configured',
    },
  })
})
