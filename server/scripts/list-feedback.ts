/**
 * List recent user feedback from MongoDB (for operators until admin UI exists).
 *
 * Usage (from server/):
 *   npm run feedback:list
 *   npm run feedback:list -- --unread
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Feedback } from '../src/models/Feedback.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'
const unreadOnly = process.argv.includes('--unread')

function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

async function listFeedback() {
  await mongoose.connect(MONGODB_URI)

  const filter = unreadOnly ? { read: false } : {}
  const items = await Feedback.find(filter).sort({ createdAt: -1 }).limit(50).lean()

  if (items.length === 0) {
    console.log(unreadOnly ? 'No unread feedback.' : 'No feedback yet.')
    await mongoose.disconnect()
    return
  }

  console.log(unreadOnly ? 'Unread feedback (latest 50):\n' : 'Latest feedback (50):\n')

  for (const item of items) {
    const date = item.createdAt.toISOString().slice(0, 16).replace('T', ' ')
    const readMark = item.read ? ' ' : '*'
    console.log(`${readMark} [${date}] ${formatType(item.type)} — ${item.userName} <${item.userEmail}>`)
    console.log(`  ${item.message.replace(/\s+/g, ' ').trim()}`)
    if (item.pageUrl) console.log(`  page: ${item.pageUrl}`)
    console.log('')
  }

  await mongoose.disconnect()
}

listFeedback().catch((err) => {
  console.error('Failed to list feedback:', err)
  process.exit(1)
})
