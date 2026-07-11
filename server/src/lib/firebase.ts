import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'

let initialized = false

function loadServiceAccount(): admin.ServiceAccount | null {
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (jsonPath) {
    const raw = readFileSync(jsonPath, 'utf8')
    return JSON.parse(raw) as admin.ServiceAccount
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey }
  }

  return null
}

/** Initialize Firebase Admin once. Safe to call multiple times. */
export function initFirebaseAdmin(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true
    return
  }

  const serviceAccount = loadServiceAccount()
  if (!serviceAccount) {
    console.warn(
      '[auth] Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_PATH). Protected routes will reject requests.',
    )
    return
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
  initialized = true
  console.log('[auth] Firebase Admin initialized')
}

export function isFirebaseReady(): boolean {
  return admin.apps.length > 0
}

export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  if (!isFirebaseReady()) {
    throw new Error('AUTH_NOT_CONFIGURED')
  }
  return admin.auth().verifyIdToken(idToken, true)
}

function isFirebaseUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'auth/user-not-found'
  )
}

/** Permanently remove the Firebase Auth user (called during account deletion). */
export async function deleteFirebaseAuthUser(uid: string): Promise<void> {
  if (!isFirebaseReady()) {
    throw new Error('AUTH_NOT_CONFIGURED')
  }
  try {
    await admin.auth().deleteUser(uid)
  } catch (error) {
    if (isFirebaseUserNotFound(error)) return
    throw error
  }
}

export { admin }
