import mongoose, { Schema, type Document, type Model } from 'mongoose'

export type FeatureType = 'ramp' | 'elevator' | 'restroom' | 'parking' | 'pathway' | 'signage'
export type AccessibilityStatus = 'accessible' | 'partial' | 'inaccessible' | 'unverified'
export type AIVerdict = 'approved' | 'flagged' | 'pending'
export type LocationSource = 'seed' | 'community'
export type LocationCategory = 'mall' | 'school' | 'government' | 'hospital' | 'transport' | 'other'

export interface IReport {
  _id: mongoose.Types.ObjectId
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: AIVerdict
  createdAt: Date
  updatedAt: Date
}

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
  reports: IReport[]
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
  createdAt: string
  updatedAt: string
}

export interface ReportJSON {
  id: string
  locationId: string
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: AIVerdict
  createdAt: string
  updatedAt?: string
}

const ReportSchema = new Schema<IReport>(
  {
    featureType: {
      type: String,
      required: true,
      enum: ['ramp', 'elevator', 'restroom', 'parking', 'pathway', 'signage'],
    },
    status: {
      type: String,
      required: true,
      enum: ['accessible', 'partial', 'inaccessible', 'unverified'],
    },
    description: { type: String, maxlength: 280 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    aiVerdict: {
      type: String,
      enum: ['approved', 'flagged', 'pending'],
      default: 'pending',
    },
  },
  { timestamps: true },
)

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
    reports: [ReportSchema],
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
        
        delete ret._id
        delete ret.__v
        delete ret.coordinates
        
        if (Array.isArray(ret.reports)) {
          ret.reports = (ret.reports as Array<Record<string, unknown>>).map((r) => ({
            id: String(r._id),
            locationId: id,
            featureType: r.featureType,
            status: r.status,
            description: r.description,
            upvotes: r.upvotes,
            downvotes: r.downvotes,
            verified: r.verified,
            aiVerdict: r.aiVerdict,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
            updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
          }))
        }
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

export const Location: Model<ILocation> =
  mongoose.models.Location ?? mongoose.model<ILocation>('Location', LocationSchema)
