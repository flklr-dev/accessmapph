import mongoose from 'mongoose'
import { Location } from '../models/Location.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  if (!value?.trim()) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return max !== undefined ? Math.min(parsed, max) : parsed
}

/** Build pool/timeouts from env — tune per deploy without code changes. */
function buildConnectOptions(): mongoose.ConnectOptions {
  return {
    maxPoolSize: parsePositiveInt(process.env.MONGODB_MAX_POOL_SIZE, 10, 100),
    minPoolSize: parsePositiveInt(process.env.MONGODB_MIN_POOL_SIZE, 0, 50),
    serverSelectionTimeoutMS: parsePositiveInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      5_000,
      30_000,
    ),
    socketTimeoutMS: parsePositiveInt(process.env.MONGODB_SOCKET_TIMEOUT_MS, 45_000, 120_000),
    maxIdleTimeMS: parsePositiveInt(process.env.MONGODB_MAX_IDLE_TIME_MS, 60_000, 600_000),
  }
}

const options = buildConnectOptions()

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  try {
    const conn = await mongoose.connect(MONGODB_URI, options)
    isConnected = true
    void Location.syncIndexes().catch((err) => {
      console.warn('[mongodb] index sync warning:', err instanceof Error ? err.message : err)
    })
    console.log(
      `MongoDB connected: ${conn.connection.host} (pool max=${options.maxPoolSize}, min=${options.minPoolSize})`,
    )
  } catch (error) {
    console.error('MongoDB connection error:', error)
    process.exit(1)
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return

  try {
    await mongoose.disconnect()
    isConnected = false
    console.log('MongoDB disconnected')
  } catch (error) {
    console.error('MongoDB disconnect error:', error)
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1
}

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err)
})

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected')
  isConnected = false
})

process.on('SIGINT', async () => {
  await disconnectDB()
  process.exit(0)
})

export { mongoose }
