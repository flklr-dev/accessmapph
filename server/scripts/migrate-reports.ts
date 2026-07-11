/**
 * One-time migration: extract embedded Location.reports into the Report collection.
 *
 * Safe to re-run: skips reports whose _id already exists in Report.
 * After success, unsets the embedded `reports` array on Location documents.
 *
 * Usage: npm run migrate:reports  (from server/)
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Location } from '../src/models/Location.js'
import { Report } from '../src/models/Report.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'

async function migrate() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  // Read raw documents — Location schema no longer declares `reports`, but
  // legacy data may still have the embedded array on disk.
  const collection = mongoose.connection.collection('locations')
  const cursor = collection.find({ reports: { $exists: true, $ne: [] } })

  let locationsScanned = 0
  let reportsInserted = 0
  let reportsSkipped = 0

  for await (const loc of cursor) {
    locationsScanned += 1
    const embedded = Array.isArray(loc.reports) ? loc.reports : []
    if (embedded.length === 0) continue

    for (const r of embedded) {
      const reportId = r._id
      if (!reportId) {
        console.warn(`  Skipping report without _id on location ${loc._id}`)
        continue
      }

      const exists = await Report.exists({ _id: reportId })
      if (exists) {
        reportsSkipped += 1
        continue
      }

      await Report.create({
        _id: reportId,
        locationId: loc._id,
        userId: r.userId,
        featureType: r.featureType,
        status: r.status,
        description: r.description,
        photos: Array.isArray(r.photos) ? r.photos : [],
        upvotes: r.upvotes ?? 0,
        downvotes: r.downvotes ?? 0,
        verified: r.verified ?? false,
        aiVerdict: r.aiVerdict ?? 'pending',
        upvoterIds: Array.isArray(r.upvoterIds) ? r.upvoterIds : [],
        downvoterIds: Array.isArray(r.downvoterIds) ? r.downvoterIds : [],
        flaggerIds: Array.isArray(r.flaggerIds) ? r.flaggerIds : [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })
      reportsInserted += 1
    }
  }

  const unsetResult = await collection.updateMany(
    { reports: { $exists: true } },
    { $unset: { reports: '' } },
  )

  // Ensure indexes exist on the new collection.
  await Report.syncIndexes()
  await Location.syncIndexes()

  console.log('\nMigration complete:')
  console.log(`  Locations scanned: ${locationsScanned}`)
  console.log(`  Reports inserted:  ${reportsInserted}`)
  console.log(`  Reports skipped:   ${reportsSkipped} (already migrated)`)
  console.log(`  Locations cleaned: ${unsetResult.modifiedCount}`)

  await mongoose.disconnect()
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
