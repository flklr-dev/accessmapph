import type { DecodedIdToken } from 'firebase-admin/auth'
import { User, type IUser, type UserJSON } from '../models/User.js'

export interface AuthIdentity {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
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

/** Upsert local user profile from a verified Firebase ID token. */
export async function upsertUserFromToken(token: DecodedIdToken): Promise<IUser> {
  const email = token.email?.toLowerCase().trim()
  if (!email) {
    throw new Error('EMAIL_REQUIRED')
  }

  const displayName = displayNameFromToken(token)
  const photoURL = typeof token.picture === 'string' ? token.picture : null

  const user = await User.findOneAndUpdate(
    { firebaseUid: token.uid },
    {
      $set: {
        email,
        displayName,
        photoURL,
      },
      $setOnInsert: {
        firebaseUid: token.uid,
        points: 0,
        level: 'newcomer',
        reportCount: 0,
      },
    },
    { upsert: true, new: true, runValidators: true },
  )

  if (!user) {
    throw new Error('USER_UPSERT_FAILED')
  }

  return user
}

export async function getUserByFirebaseUid(uid: string): Promise<IUser | null> {
  return User.findOne({ firebaseUid: uid })
}

export async function getPublicUserByFirebaseUid(uid: string): Promise<UserJSON | null> {
  const user = await getUserByFirebaseUid(uid)
  return user ? toPublicUser(user) : null
}

export async function recordReportContribution(firebaseUid: string): Promise<void> {
  const user = await User.findOne({ firebaseUid })
  if (!user) return

  user.reportCount += 1
  user.points += 10
  user.lastReportAt = new Date()

  if (user.points >= 500) user.level = 'champion'
  else if (user.points >= 200) user.level = 'trusted'
  else if (user.points >= 50) user.level = 'contributor'
  else user.level = 'newcomer'

  await user.save()
}

export { toPublicUser }
