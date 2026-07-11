import 'dotenv/config'
import mongoose from 'mongoose'
import { Location } from '../src/models/Location.js'
import { encodeGeohash } from '../src/lib/geo.js'
import { POPULAR_PLACES } from './popularPlaces.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'

async function seed() {
  const fresh = process.argv.includes('--fresh')

  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log(`Connected (${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')})`)

  if (fresh) {
    console.log('Removing existing seed locations (--fresh)...')
    const deleted = await Location.deleteMany({ source: 'seed' })
    console.log(`  removed ${deleted.deletedCount} seed locations`)
  }

  let created = 0
  let updated = 0

  console.log(`Seeding ${POPULAR_PLACES.length} popular places (no reports)...`)

  for (const place of POPULAR_PLACES) {
    const geohash = encodeGeohash(place.lat, place.lng)
    const payload = {
      name: place.name,
      address: place.address,
      coordinates: {
        type: 'Point' as const,
        coordinates: [place.lng, place.lat] as [number, number],
      },
      category: place.category,
      city: place.city,
      geohash,
      placeKey: place.placeKey,
      source: 'seed' as const,
      createdBy: null,
    }

    const existing = await Location.findOne({ placeKey: place.placeKey })

    if (existing) {
      await Location.updateOne({ _id: existing._id }, { $set: payload })
      updated++
      console.log(`  ↻ ${place.name}`)
      continue
    }

    await Location.create(payload)
    created++
    console.log(`  + ${place.name}`)
  }

  const total = await Location.countDocuments({ source: 'seed' })
  console.log(`\nDone — created ${created}, updated ${updated}`)
  console.log(`Seed locations in database: ${total}`)
  console.log('Reports: none (users add the first reports via the app)')

  await mongoose.disconnect()
}

seed().catch((error) => {
  console.error('Seed error:', error)
  process.exit(1)
})
