import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDB } from './lib/db.js'
import { initFirebaseAdmin } from './lib/firebase.js'
import { locationsRouter } from './routes/locations.js'
import { healthRouter } from './routes/health.js'
import { reportsRouter } from './routes/reports.js'
import { authRouter } from './routes/auth.js'

const app = express()
const PORT = process.env.PORT ?? 3001

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.CLIENT_URL,
].filter(Boolean) as string[]

app.use(
  cors({
    origin: allowedOrigins,
  }),
)
app.use(express.json({ limit: '32kb' }))

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/reports', reportsRouter)

async function start() {
  try {
    initFirebaseAdmin()
    await connectDB()
    app.listen(PORT, () => {
      console.log(`AccessMap PH API running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
