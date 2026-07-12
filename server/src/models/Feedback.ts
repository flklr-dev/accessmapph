import mongoose, { Schema, type Document, type Model } from 'mongoose'

export type FeedbackType = 'suggestion' | 'bug' | 'other'

export interface IFeedback extends Document {
  _id: mongoose.Types.ObjectId
  userId: string
  userEmail: string
  userName: string
  type: FeedbackType
  message: string
  pageUrl: string | null
  userAgent: string | null
  read: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FeedbackJSON {
  id: string
  type: FeedbackType
  message: string
  createdAt: string
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userName: { type: String, required: true, trim: true, maxlength: 80 },
    type: {
      type: String,
      required: true,
      enum: ['suggestion', 'bug', 'other'],
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    pageUrl: { type: String, default: null, maxlength: 500 },
    userAgent: { type: String, default: null, maxlength: 500 },
    read: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id)
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  },
)

FeedbackSchema.index({ createdAt: -1 })

export const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ?? mongoose.model<IFeedback>('Feedback', FeedbackSchema)
