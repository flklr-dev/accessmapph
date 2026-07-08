import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth'
import { deleteAccount as deleteAccountApi } from '../api/auth'
import { getFirebaseAuth, isFirebaseConfigured } from './firebase'

function mapAuthError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : ''

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Pop-up was blocked. Allow pop-ups for this site.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.'
    case 'auth/requires-recent-login':
      return 'For your security, sign in again before deleting your account.'
    default:
      return 'Could not complete sign-in. Please try again.'
  }
}

function verificationActionCodeSettings(): ActionCodeSettings {
  return {
    url: `${window.location.origin}/`,
    handleCodeInApp: false,
  }
}

async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user, verificationActionCodeSettings())
}

export function isPasswordUser(user: User | null | undefined): boolean {
  if (!user) return false
  return user.providerData.some((p) => p.providerId === 'password')
}

export function needsEmailVerification(user: User | null | undefined): boolean {
  return Boolean(user && isPasswordUser(user) && !user.emailVerified)
}

export async function signInWithEmail(email: string, password: string) {
  if (!isFirebaseConfigured()) throw new Error('Auth is not configured yet.')
  try {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
  } catch (error) {
    throw new Error(mapAuthError(error))
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<{ verificationSent: boolean; verificationError?: string }> {
  if (!isFirebaseConfigured()) throw new Error('Auth is not configured yet.')
  try {
    const cred = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    )
    const name = displayName.trim()
    if (name) {
      await updateProfile(cred.user, { displayName: name })
    }

    try {
      await sendVerificationEmail(cred.user)
      return { verificationSent: true }
    } catch (verifyError) {
      console.error('[auth] Failed to send verification email:', verifyError)
      return {
        verificationSent: false,
        verificationError:
          verifyError instanceof Error
            ? mapAuthError(verifyError)
            : 'Could not send verification email.',
      }
    }
  } catch (error) {
    throw new Error(mapAuthError(error))
  }
}

export async function resendVerificationEmail() {
  if (!isFirebaseConfigured()) throw new Error('Auth is not configured yet.')
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Sign in first, then resend the verification email.')
  if (user.emailVerified) throw new Error('Your email is already verified.')

  try {
    await sendVerificationEmail(user)
  } catch (error) {
    throw new Error(mapAuthError(error))
  }
}

/** Reload Firebase user (e.g. after they click the verify link). */
export async function reloadCurrentUser(): Promise<User | null> {
  const user = getFirebaseAuth().currentUser
  if (!user) return null
  await user.reload()
  return getFirebaseAuth().currentUser
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured()) throw new Error('Auth is not configured yet.')
  try {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(getFirebaseAuth(), provider)
  } catch (error) {
    throw new Error(mapAuthError(error))
  }
}

export async function signOutUser() {
  if (!isFirebaseConfigured()) return
  await signOut(getFirebaseAuth())
}

/**
 * Re-authenticate before destructive actions (account deletion).
 * Password users must supply their current password; OAuth users get a provider popup.
 */
export async function reauthenticateForSensitiveAction(password?: string): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('Auth is not configured yet.')

  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Sign in required.')

  try {
    if (isPasswordUser(user)) {
      if (!password?.trim()) {
        throw new Error('Enter your password to confirm this action.')
      }
      const email = user.email
      if (!email) throw new Error('Account email is missing.')
      const cred = EmailAuthProvider.credential(email, password)
      await reauthenticateWithCredential(user, cred)
      return
    }

    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'login' })
    await reauthenticateWithPopup(user, provider)
  } catch (error) {
    throw new Error(mapAuthError(error))
  }
}

/**
 * Permanently delete the account: re-authenticate, wipe server data + Firebase Auth user,
 * then clear the local session.
 */
export async function deleteAccount(password?: string) {
  if (!isFirebaseConfigured()) throw new Error('Auth is not configured yet.')
  try {
    await reauthenticateForSensitiveAction(password)
    await deleteAccountApi()
    await signOut(getFirebaseAuth())
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Could not delete account. Please try again.')
  }
}
