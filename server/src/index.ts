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
import { healthRouter } from './routes/health.js'
import { reportsRouter } from './routes/reports.js'
import { authRouter } from './routes/auth.js'
import { uploadsRouter } from './routes/uploads.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { securityHeaders } from './middleware/security.js'
import { noStore } from './middleware/httpCache.js'
import { requestLogger, logServerError } from './middleware/requestLogger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initJobWorkers } from './jobs/index.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.disable('x-powered-by')
app.set('trust proxy', 1)

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.CLIENT_URL?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []),
]

app.use(...securityHeaders)
app.use(compression({ threshold: 1024 }))
app.use(requestLogger)
app.use(
  cors({
    origin: allowedOrigins,
  }),
)
app.use(express.json({ limit: '32kb' }))
/** Private/mutating responses stay uncached unless a route overrides. */
app.use(noStore())

/** Render's default health probe hits `/` with HEAD — must return 2xx. */
app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'accessmapph-api' })
})
app.head('/', (_req, res) => {
  res.status(200).end()
})

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/leaderboard', leaderboardRouter)

app.use(errorHandler)

async function start() {
  const host = '0.0.0.0'

  // Open the port immediately so Render's health probe can succeed while DB/Redis connect.
  await new Promise<void>((resolve) => {
    app.listen(Number(PORT), host, () => {
      console.log(`AccessMap PH API listening on ${host}:${PORT}`)
      resolve()
    })
  })

  try {
    initFirebaseAdmin()
    const redis = await initRedis()
    initSlidingWindowStore(redis)
    initGeocodeCache(redis)
    initAuthSessionCache(redis)
    await connectDB()
    initJobWorkers()
    console.log('[startup] Firebase, MongoDB, Redis, and job workers ready')
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
