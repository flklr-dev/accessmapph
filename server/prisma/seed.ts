import 'dotenv/config'
import mongoose from 'mongoose'
import { Location } from '../src/models/Location.js'
import { encodeGeohash } from '../src/lib/geo.js'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/accessmapph'

const seedLocations = [
  {
    name: 'SM Mall of Asia',
    address: 'Seaside Blvd, Pasay City, Metro Manila',
    lat: 14.5352,
    lng: 120.9822,
    category: 'mall' as const,
    city: 'Manila',
    source: 'seed' as const,
    reports: [
      {
        featureType: 'ramp' as const,
        status: 'accessible' as const,
        description: 'Wide ramp at main entrance with handrails on both sides.',
        upvotes: 12,
        downvotes: 0,
        verified: true,
        aiVerdict: 'approved' as const,
      },
      {
        featureType: 'elevator' as const,
        status: 'partial' as const,
        description: 'North wing elevator out of service as of last week.',
        upvotes: 5,
        downvotes: 1,
        verified: false,
        aiVerdict: 'approved' as const,
      },
    ],
  },
  {
    name: 'Manila City Hall',
    address: 'Padre Burgos Ave, Ermita, Manila',
    lat: 14.5906,
    lng: 120.9817,
    category: 'government' as const,
    city: 'Manila',
    source: 'seed' as const,
    reports: [
      {
        featureType: 'ramp' as const,
        status: 'inaccessible' as const,
        description: 'Front ramp too steep and no landing at the top.',
        upvotes: 8,
        downvotes: 0,
        verified: true,
        aiVerdict: 'approved' as const,
      },
      {
        featureType: 'restroom' as const,
        status: 'partial' as const,
        description: 'PWD restroom on 2F exists but often locked — ask guard.',
        upvotes: 3,
        downvotes: 0,
        verified: false,
        aiVerdict: 'approved' as const,
      },
    ],
  },
  {
    name: 'Abreeza Mall',
    address: 'J.P. Laurel Ave, Davao City',
    lat: 7.1183,
    lng: 125.6478,
    category: 'mall' as const,
    city: 'Davao',
    source: 'seed' as const,
    reports: [
      {
        featureType: 'ramp' as const,
        status: 'accessible' as const,
        description: 'Level entry from parking with automatic doors.',
        upvotes: 15,
        downvotes: 0,
        verified: true,
        aiVerdict: 'approved' as const,
      },
      {
        featureType: 'parking' as const,
        status: 'accessible' as const,
        description: 'Dedicated PWD slots near all entrances.',
        upvotes: 9,
        downvotes: 0,
        verified: true,
        aiVerdict: 'approved' as const,
      },
    ],
  },
  {
    name: 'Southern Philippines Medical Center',
    address: 'JP Laurel Ave, Davao City',
    lat: 7.0975,
    lng: 125.6211,
    category: 'hospital' as const,
    city: 'Davao',
    source: 'seed' as const,
    reports: [
      {
        featureType: 'elevator' as const,
        status: 'accessible' as const,
        description: 'All public elevators are wheelchair-accessible.',
        upvotes: 6,
        downvotes: 0,
        verified: true,
        aiVerdict: 'approved' as const,
      },
    ],
  },
  {
    name: 'Ayala Center Cebu',
    address: 'Cebu Business Park, Cebu City',
    lat: 10.3187,
    lng: 123.9064,
    category: 'mall' as const,
    city: 'Cebu',
    source: 'seed' as const,
    reports: [
      {
        featureType: 'pathway' as const,
        status: 'partial' as const,
        description: 'Outdoor walkways have uneven tiles in some sections.',
        upvotes: 4,
        downvotes: 2,
        verified: false,
        aiVerdict: 'approved' as const,
      },
      {
        featureType: 'signage' as const,
        status: 'unverified' as const,
        description: 'Braille signage reported on 3F but not yet confirmed.',
        upvotes: 1,
        downvotes: 0,
        verified: false,
        aiVerdict: 'approved' as const,
      },
    ],
  },
  {
    name: 'Cebu City Hall',
    address: 'M.J. Cuenco Ave, Cebu City',
    lat: 10.2926,
    lng: 123.9022,
    category: 'government' as const,
    city: 'Cebu',
    source: 'seed' as const,
    reports: [
      {
        featureType: 'ramp' as const,
        status: 'partial' as const,
        description: 'Side entrance ramp available but narrow for power chairs.',
        upvotes: 7,
        downvotes: 1,
        verified: true,
        aiVerdict: 'approved' as const,
      },
    ],
  },
]

async function seed() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  console.log('Clearing existing locations...')
  await Location.deleteMany({})

  console.log('Seeding locations...')
  for (const loc of seedLocations) {
    const geohash = encodeGeohash(loc.lat, loc.lng)
    await Location.create({
      name: loc.name,
      address: loc.address,
      coordinates: {
        type: 'Point',
        coordinates: [loc.lng, loc.lat],
      },
      category: loc.category,
      city: loc.city,
      geohash,
      placeKey: null,
      source: loc.source,
      reports: loc.reports,
    })
    console.log(`  ✓ ${loc.name}`)
  }

  console.log(`\nSeeded ${seedLocations.length} locations`)
  await mongoose.disconnect()
  console.log('Done!')
}

seed().catch((error) => {
  console.error('Seed error:', error)
  process.exit(1)
})
