import mongoose, { Schema, type Document, type Model } from 'mongoose'

export type UserLevel = 'newcomer' | 'contributor' | 'trusted' | 'champion'

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  firebaseUid: string
  email: string
  displayName: string
  photoURL: string | null
  points: number
  level: UserLevel
  city: string | null
  reportCount: number
  /** Times this user's reports were flagged/hidden by the community. Demotes trust. */
  flaggedCount: number
  lastReportAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UserJSON {
  id: string
  email: string
  displayName: string
  photoURL: string | null
  points: number
  level: UserLevel
  city: string | null
  reportCount: number
  createdAt: string
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    photoURL: { type: String, default: null },
    points: { type: Number, default: 0, min: 0 },
    level: {
      type: String,
      enum: ['newcomer', 'contributor', 'trusted', 'champion'],
      default: 'newcomer',
    },
    city: { type: String, default: null, trim: true },
    reportCount: { type: Number, default: 0, min: 0 },
    flaggedCount: { type: Number, default: 0, min: 0 },
    lastReportAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id)
        delete ret._id
        delete ret.__v
        delete ret.firebaseUid
        if (ret.createdAt instanceof Date) {
          ret.createdAt = ret.createdAt.toISOString()
        }
        if (ret.updatedAt instanceof Date) {
          ret.updatedAt = ret.updatedAt.toISOString()
        }
        delete ret.updatedAt
        delete ret.lastReportAt
        return ret
      },
    },
  },
)

UserSchema.index({ email: 1 })
UserSchema.index({ points: -1, reportCount: -1 })

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)
