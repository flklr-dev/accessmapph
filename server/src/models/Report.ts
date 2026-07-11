import mongoose, { Schema, type Document, type Model } from 'mongoose'
import type {
  AccessibilityStatus,
  AIVerdict,
  FeatureType,
  ReportJSON,
} from './Location.js'

export interface IReportDoc extends Document {
  _id: mongoose.Types.ObjectId
  locationId: mongoose.Types.ObjectId
  userId?: string
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  /** Cloudinary secure_urls, verified server-side before being attached to the report. */
  photos: string[]
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: AIVerdict
  /** Voter/flagger uids — kept server-side only for idempotency, never sent to clients. */
  upvoterIds: string[]
  downvoterIds: string[]
  flaggerIds: string[]
  createdAt: Date
  updatedAt: Date
}

const ReportSchema = new Schema<IReportDoc>(
  {
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    userId: { type: String, index: true },
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
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length <= 3,
        message: 'A report can have at most 3 photos.',
      },
    },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    aiVerdict: {
      type: String,
      enum: ['approved', 'flagged', 'pending'],
      default: 'pending',
    },
    upvoterIds: { type: [String], default: [] },
    downvoterIds: { type: [String], default: [] },
    flaggerIds: { type: [String], default: [] },
  },
  { timestamps: true },
)

ReportSchema.index({ locationId: 1, createdAt: -1 })
ReportSchema.index({ userId: 1, createdAt: -1 })
ReportSchema.index({ locationId: 1, userId: 1, featureType: 1 })
ReportSchema.index({ upvoterIds: 1 })
ReportSchema.index({ downvoterIds: 1 })
ReportSchema.index({ flaggerIds: 1 })

/** Slim pin-list report — enough for filters/status, no heavy fields. */
export function toSlimReport(r: {
  _id: mongoose.Types.ObjectId
  locationId: mongoose.Types.ObjectId | string
  featureType: string
  status: string
  upvotes?: number
  downvotes?: number
  verified?: boolean
  aiVerdict?: string
  createdAt?: Date
}): Pick<
  ReportJSON,
  | 'id'
  | 'locationId'
  | 'featureType'
  | 'status'
  | 'photos'
  | 'upvotes'
  | 'downvotes'
  | 'verified'
  | 'aiVerdict'
  | 'createdAt'
> {
  return {
    id: r._id.toString(),
    locationId: String(r.locationId),
    featureType: r.featureType as FeatureType,
    status: r.status as AccessibilityStatus,
    photos: [],
    upvotes: r.upvotes ?? 0,
    downvotes: r.downvotes ?? 0,
    verified: r.verified ?? false,
    aiVerdict: (r.aiVerdict ?? 'pending') as AIVerdict,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  }
}

/** Full public report (no voter ID arrays). */
export function toFullReport(
  r: IReportDoc | {
    _id: mongoose.Types.ObjectId
    locationId: mongoose.Types.ObjectId | string
    userId?: string
    featureType: FeatureType | string
    status: AccessibilityStatus | string
    description?: string
    photos?: string[]
    upvotes?: number
    downvotes?: number
    verified?: boolean
    aiVerdict?: AIVerdict | string
    createdAt?: Date
  },
  author?: { name: string; photoURL: string | null },
): ReportJSON {
  const locationId = String(r.locationId)
  return {
    id: r._id.toString(),
    locationId,
    authorName: r.userId ? author?.name ?? 'Contributor' : null,
    authorPhotoURL: r.userId ? author?.photoURL ?? null : null,
    featureType: r.featureType as FeatureType,
    status: r.status as AccessibilityStatus,
    description: r.description,
    photos: Array.isArray(r.photos) ? r.photos : [],
    upvotes: r.upvotes ?? 0,
    downvotes: r.downvotes ?? 0,
    verified: r.verified ?? false,
    aiVerdict: (r.aiVerdict ?? 'pending') as AIVerdict,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt ?? new Date().toISOString()),
  }
}

export const Report: Model<IReportDoc> =
  mongoose.models.Report ?? mongoose.model<IReportDoc>('Report', ReportSchema)
