import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'

const options: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  try {
    const conn = await mongoose.connect(MONGODB_URI, options)
    isConnected = true
    console.log(`MongoDB connected: ${conn.connection.host}`)
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
