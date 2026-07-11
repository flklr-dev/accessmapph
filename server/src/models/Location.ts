import mongoose, { Schema, type Document, type Model } from 'mongoose'

export type FeatureType = 'ramp' | 'elevator' | 'restroom' | 'parking' | 'pathway' | 'signage'
export type AccessibilityStatus = 'accessible' | 'partial' | 'inaccessible' | 'unverified'
export type AIVerdict = 'approved' | 'flagged' | 'pending'
export type LocationSource = 'seed' | 'community'
export type LocationCategory = 'mall' | 'school' | 'government' | 'hospital' | 'transport' | 'other'

export interface ILocation extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  address: string
  coordinates: {
    type: 'Point'
    coordinates: [number, number]
  }
  category: LocationCategory
  city: string
  geohash: string
  placeKey: string | null
  source: LocationSource
  createdBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface LocationJSON {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  category: LocationCategory
  city: string
  geohash: string
  placeKey: string | null
  source: LocationSource
  reports: ReportJSON[]
  reportsLoaded?: boolean
  createdAt: string
  updatedAt: string
}

export interface ReportJSON {
  id: string
  locationId: string
  /** Public first name of the report author (privacy: never full name). */
  authorName?: string | null
  /** Public avatar of the report author, if any (same as leaderboard). */
  authorPhotoURL?: string | null
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  photos: string[]
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: AIVerdict
  createdAt: string
  updatedAt?: string
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords: number[]) =>
            coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 &&
            coords[1] >= -90 && coords[1] <= 90,
          message: 'Invalid coordinates [lng, lat]',
        },
      },
    },
    category: {
      type: String,
      enum: ['mall', 'school', 'government', 'hospital', 'transport', 'other'],
      default: 'other',
    },
    city: { type: String, required: true, trim: true },
    geohash: { type: String, required: true },
    placeKey: { type: String, default: null },
    source: {
      type: String,
      enum: ['seed', 'community'],
      default: 'community',
    },
    createdBy: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        const id = String(ret._id)
        const coords = ret.coordinates as { coordinates: [number, number] } | undefined

        ret.id = id
        ret.lat = coords?.coordinates?.[1]
        ret.lng = coords?.coordinates?.[0]
        // Reports live in the Report collection — assembled by services.
        if (!Array.isArray(ret.reports)) {
          ret.reports = []
        }

        delete ret._id
        delete ret.__v
        delete ret.coordinates

        return ret
      },
    },
  },
)

LocationSchema.index({ coordinates: '2dsphere' })
LocationSchema.index({ city: 1 })
LocationSchema.index({ category: 1 })
LocationSchema.index({ geohash: 1 })
LocationSchema.index({ placeKey: 1 }, { sparse: true })
LocationSchema.index({ name: 1 })
LocationSchema.index(
  { name: 'text', address: 'text', city: 'text' },
  {
    weights: { name: 10, address: 5, city: 3 },
    name: 'location_text_search',
  },
)

export const Location: Model<ILocation> =
  mongoose.models.Location ?? mongoose.model<ILocation>('Location', LocationSchema)
