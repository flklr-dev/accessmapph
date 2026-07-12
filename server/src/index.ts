import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import { connectDB } from './lib/db.js'
import { initFirebaseAdmin } from './lib/firebase.js'
import { initAuthSessionCache, initGeocodeCache } from './lib/jsonCache.js'
import { initRedis, closeRedis } from './lib/redis.js'
import { initSlidingWindowStore } from './lib/slidingWindowStore.js'
import { locationsRouter } from './routes/locations.js'
import { healthRouter, sendLiveness, sendLivenessHead } from './routes/health.js'
import { reportsRouter } from './routes/reports.js'
import { authRouter } from './routes/auth.js'
import { uploadsRouter } from './routes/uploads.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { feedbackRouter } from './routes/feedback.js'
import { securityHeaders } from './middleware/security.js'
import { noStore } from './middleware/httpCache.js'
import { requestLogger, logServerError } from './middleware/requestLogger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initJobWorkers } from './jobs/index.js'
import { buildCorsOptions, applyCorsHeaders } from './lib/corsConfig.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.disable('x-powered-by')
app.set('trust proxy', 1)

/**
 * Health probes BEFORE middleware — Render requires 2xx within 5 seconds.
 * Set Render "Health Check Path" to `/health`.
 */
app.get('/health', (_req, res) => sendLiveness(res))
app.head('/health', (_req, res) => sendLivenessHead(res))
app.get('/', (_req, res) => sendLiveness(res))
app.head('/', (_req, res) => sendLivenessHead(res))

// CORS first — auth routes send Authorization and require preflight (OPTIONS).
app.use(cors(buildCorsOptions()))

app.use(...securityHeaders)
app.use(compression({ threshold: 1024 }))
app.use(requestLogger)
app.use(express.json({ limit: '32kb' }))
/** Private/mutating responses stay uncached unless a route overrides. */
app.use(noStore())

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/feedback', feedbackRouter)

app.use(errorHandler)

async function start() {
  const host = '0.0.0.0'

  try {
    initFirebaseAdmin()
    const [redis] = await Promise.all([initRedis(), connectDB()])
    initSlidingWindowStore(redis)
    initGeocodeCache(redis)
    initAuthSessionCache(redis)
    initJobWorkers()
    console.log('[startup] Firebase, MongoDB, Redis, and job workers ready')

    await new Promise<void>((resolve) => {
      app.listen(Number(PORT), host, () => {
        console.log(`AccessMap PH API listening on ${host}:${PORT}`)
        console.log('[startup] Health probes: GET /health, GET /api/health/live')
        resolve()
      })
    })
  } catch (error) {
    logServerError('startup_failed', error)
    process.exit(1)
  }
}

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received, closing connections…`)
  await closeRedis()
  process.exit(0)
}

process.on('unhandledRejection', (reason) => {
  logServerError('unhandled_rejection', reason)
})

process.on('uncaughtException', (error) => {
  logServerError('uncaught_exception', error)
  process.exit(1)
})

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

start()
