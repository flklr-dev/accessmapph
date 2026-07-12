/**
 * Ensure MongoDB indexes exist (including Location text search).
 *
 * Usage: npm run db:indexes  (from server/)
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Location } from '../src/models/Location.js'
import { Feedback } from '../src/models/Feedback.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'

async function ensureIndexes() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  console.log('Syncing Location indexes (2dsphere, text search, …)')
  const locationResult = await Location.syncIndexes()
  console.log('Location index sync result:', locationResult)

  console.log('Syncing Feedback indexes…')
  const feedbackResult = await Feedback.syncIndexes()
  console.log('Feedback index sync result:', feedbackResult)

  await mongoose.disconnect()
  console.log('Done.')
}

ensureIndexes().catch((err) => {
  console.error('Index sync failed:', err)
  process.exit(1)
})
