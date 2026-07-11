import type { DecodedIdToken } from 'firebase-admin/auth'
import mongoose from 'mongoose'
import { User, type IUser, type UserJSON, type UserLevel } from '../models/User.js'
import { Location } from '../models/Location.js'
import { Report } from '../models/Report.js'
import { deleteFirebaseAuthUser } from '../lib/firebase.js'
import { destroyUpload, publicIdFromCloudinaryUrl } from '../lib/cloudinary.js'
import { toPublicFirstName } from '../lib/displayName.js'

export interface AuthIdentity {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
}

/**
 * Tier 2 moderation: trust-based auto-approval.
 * Users with a track record and zero community flags skip the "pending
 * community review" step entirely — their reports go live as approved.
 */
export const AUTO_APPROVE_MIN_REPORTS = 3
export const MAX_FLAGS_FOR_AUTO_APPROVE = 0

export interface TrustStatus {
  autoApprove: boolean
  reportCount: number
  flaggedCount: number
}

function levelForPoints(points: number): UserLevel {
  if (points >= 500) return 'champion'
  if (points >= 200) return 'trusted'
  if (points >= 50) return 'contributor'
  return 'newcomer'
}

function toPublicUser(user: IUser): UserJSON {
  return user.toJSON() as unknown as UserJSON
}

function displayNameFromToken(token: DecodedIdToken): string {
  if (typeof token.name === 'string' && token.name.trim()) return token.name.trim()
  if (typeof token.email === 'string' && token.email.includes('@')) {
    return token.email.split('@')[0]
  }
  return 'Contributor'
}

/**
 * Sync local user profile from a verified Firebase ID token.
 * Writes to Mongo only on first sign-in or when email/name/photo changed.
 */
export async function syncUserFromToken(token: DecodedIdToken): Promise<IUser> {
  const email = token.email?.toLowerCase().trim()
  if (!email) {
    throw new Error('EMAIL_REQUIRED')
  }

  const displayName = displayNameFromToken(token)
  const photoURL = typeof token.picture === 'string' ? token.picture : null

  const existing = await User.findOne({ firebaseUid: token.uid })
  if (!existing) {
    return User.create({
      firebaseUid: token.uid,
      email,
      displayName,
      photoURL,
      points: 0,
      level: 'newcomer',
      reportCount: 0,
      trustEligibleCount: 0,
    })
  }

  const profileUnchanged =
    existing.email === email &&
    existing.displayName === displayName &&
    (existing.photoURL ?? null) === photoURL

  if (profileUnchanged) {
    return existing
  }

  existing.email = email
  existing.displayName = displayName
  existing.photoURL = photoURL
  await existing.save()
  return existing
}

/** @deprecated Use syncUserFromToken — kept for any external callers. */
export const upsertUserFromToken = syncUserFromToken

export async function getUserByFirebaseUid(uid: string): Promise<IUser | null> {
  return User.findOne({ firebaseUid: uid })
}

export async function getPublicUserByFirebaseUid(uid: string): Promise<UserJSON | null> {
  const user = await getUserByFirebaseUid(uid)
  return user ? toPublicUser(user) : null
}

export interface PublicAuthor {
  name: string
  photoURL: string | null
}

/**
 * Batched author lookup for report cards — one query regardless of how many
 * distinct reports/locations are being rendered. Privacy: first name only
 * (matches leaderboard redaction); avatar photo is already public (same as
 * the leaderboard).
 */
export async function getAuthorsByUids(uids: (string | undefined)[]): Promise<Map<string, PublicAuthor>> {
  const unique = [...new Set(uids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()

  const users = await User.find({ firebaseUid: { $in: unique } })
    .select('firebaseUid displayName photoURL')
    .lean()

  return new Map(
    users.map((u) => [
      u.firebaseUid,
      { name: toPublicFirstName(u.displayName), photoURL: u.photoURL ?? null },
    ]),
  )
}

export async function recordReportContribution(
  firebaseUid: string,
  options: { verdict: 'approved' | 'pending' | 'flagged' },
): Promise<void> {
  const user = await User.findOne({ firebaseUid })
  if (!user) return

  if (options.verdict !== 'flagged') {
    user.reportCount += 1
    user.points += options.verdict === 'approved' ? 10 : 2
    user.lastReportAt = new Date()
  }

  if (options.verdict === 'approved') {
    user.trustEligibleCount += 1
  }

  user.level = levelForPoints(user.points)
  await user.save()
}

/** Tier 2: does this user's history earn auto-approval, skipping community review? */
export async function getTrustStatus(firebaseUid: string): Promise<TrustStatus> {
  const user = await getUserByFirebaseUid(firebaseUid)
  if (!user) return { autoApprove: false, reportCount: 0, flaggedCount: 0 }

  const autoApprove =
    user.trustEligibleCount >= AUTO_APPROVE_MIN_REPORTS &&
    user.flaggedCount <= MAX_FLAGS_FOR_AUTO_APPROVE

  return {
    autoApprove,
    reportCount: user.reportCount,
    flaggedCount: user.flaggedCount,
  }
}

/** Tier 3: community flagged this user's report enough to hide it. Demotes trust. */
export async function recordReportFlag(firebaseUid: string): Promise<void> {
  const user = await User.findOne({ firebaseUid })
  if (!user) return

  user.flaggedCount += 1
  user.points = Math.max(0, user.points - 15)
  user.level = levelForPoints(user.points)

  await user.save()
}

/** Tier 3: community upvotes confirmed this report. Small trust bonus. */
export async function recordReportVerified(
  firebaseUid: string,
  countTowardTrust = true,
): Promise<void> {
  const user = await User.findOne({ firebaseUid })
  if (!user) return

  if (countTowardTrust) {
    user.trustEligibleCount += 1
  }
  user.points += 5
  user.level = levelForPoints(user.points)

  await user.save()
}

export interface UserContribution {
  id: string
  locationId: string
  locationName: string
  locationCity: string
  featureType: string
  status: string
  description?: string
  photos: string[]
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict: string
  createdAt: string
}

/** All reports authored by this user, newest first. */
export async function getUserContributions(firebaseUid: string): Promise<UserContribution[]> {
  const reports = await Report.find({ userId: firebaseUid })
    .sort({ createdAt: -1 })
    .lean()

  if (reports.length === 0) return []

  const locationIds = [...new Set(reports.map((r) => String(r.locationId)))]
  const locations = await Location.find({ _id: { $in: locationIds } })
    .select('name city')
    .lean()

  const locationMap = new Map(
    locations.map((loc) => [loc._id.toString(), { name: loc.name, city: loc.city }]),
  )

  return reports.map((report) => {
    const locationId = String(report.locationId)
    const loc = locationMap.get(locationId)
    return {
      id: report._id.toString(),
      locationId,
      locationName: loc?.name ?? 'Unknown location',
      locationCity: loc?.city ?? 'Unknown',
      featureType: report.featureType,
      status: report.status,
      description: report.description,
      photos: Array.isArray(report.photos) ? report.photos : [],
      upvotes: report.upvotes ?? 0,
      downvotes: report.downvotes ?? 0,
      verified: report.verified ?? false,
      aiVerdict: report.aiVerdict ?? 'pending',
      createdAt:
        report.createdAt instanceof Date
          ? report.createdAt.toISOString()
          : String(report.createdAt ?? new Date().toISOString()),
    }
  })
}

/**
 * Permanently delete a user account and scrub personal data.
 * - Removes the user's reports (accessibility data at those pins may remain from others)
 * - Deletes their Cloudinary photos
 * - Clears their votes/flags on other reports
 * - Removes empty community pins they created alone
 * - Deletes the MongoDB profile and Firebase Auth user
 */
export async function deleteUserAccount(firebaseUid: string): Promise<void> {
  const existingUser = await User.findOne({ firebaseUid }).select('_id')
  if (!existingUser) {
    // Idempotent — deletion job may be retrying after a partial run.
    await deleteFirebaseAuthUser(firebaseUid)
    return
  }

  const ownReports = await Report.find({ userId: firebaseUid }).lean()

  const photoUrls: string[] = []
  for (const report of ownReports) {
    photoUrls.push(...(Array.isArray(report.photos) ? report.photos : []))
  }

  for (const url of photoUrls) {
    const publicId = publicIdFromCloudinaryUrl(url)
    if (publicId) await destroyUpload(publicId)
  }

  const ownLocationIds = [...new Set(ownReports.map((r) => String(r.locationId)))]
  await Report.deleteMany({ userId: firebaseUid })

  // Remove community pins this user created that now have zero reports.
  if (ownLocationIds.length > 0) {
    const remainingCounts = await Report.aggregate<{ _id: unknown; count: number }>([
      {
        $match: {
          locationId: {
            $in: ownLocationIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      { $group: { _id: '$locationId', count: { $sum: 1 } } },
    ])
    const stillHasReports = new Set(remainingCounts.map((r) => String(r._id)))
    const emptyIds = ownLocationIds.filter((id) => !stillHasReports.has(id))
    if (emptyIds.length > 0) {
      await Location.deleteMany({
        _id: { $in: emptyIds },
        createdBy: firebaseUid,
        source: 'community',
      })
    }
  }

  // Scrub this user's votes/flags, then recompute counts only on touched docs.
  const votedReportIds = await Report.find({
    $or: [
      { upvoterIds: firebaseUid },
      { downvoterIds: firebaseUid },
      { flaggerIds: firebaseUid },
    ],
  })
    .select('_id')
    .lean()

  if (votedReportIds.length > 0) {
    const ids = votedReportIds.map((r) => r._id)
    await Report.updateMany(
      { _id: { $in: ids } },
      {
        $pull: {
          upvoterIds: firebaseUid,
          downvoterIds: firebaseUid,
          flaggerIds: firebaseUid,
        },
      },
    )
    await Report.updateMany({ _id: { $in: ids } }, [
      {
        $set: {
          upvotes: { $size: { $ifNull: ['$upvoterIds', []] } },
          downvotes: { $size: { $ifNull: ['$downvoterIds', []] } },
        },
      },
    ])
  }

  await Location.updateMany({ createdBy: firebaseUid }, { $set: { createdBy: null } })

  // Delete Firebase Auth first so a failed auth delete leaves the Mongo profile intact for retry.
  await deleteFirebaseAuthUser(firebaseUid)

  const deleted = await User.deleteOne({ firebaseUid })
  if (deleted.deletedCount === 0) {
    return
  }
}

export { toPublicUser }
