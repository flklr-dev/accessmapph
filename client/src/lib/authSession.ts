import type { User as FirebaseUser } from 'firebase/auth'

/** Module-level session holder so API layer can attach tokens without React. */
let currentUser: FirebaseUser | null = null

export function setAuthSessionUser(user: FirebaseUser | null) {
  currentUser = user
}

export function getAuthSessionUser(): FirebaseUser | null {
  return currentUser
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!currentUser) return null
  try {
    return await currentUser.getIdToken(forceRefresh)
  } catch {
    return null
  }
}
