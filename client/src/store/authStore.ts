import { create } from 'zustand'
import type { User as FirebaseUser } from 'firebase/auth'
import type { AppUser } from '../types/auth'
import { needsEmailVerification } from '../lib/authActions'

type PendingAction = (() => void) | null

interface AuthState {
  firebaseUser: FirebaseUser | null
  profile: AppUser | null
  loading: boolean
  isAuthModalOpen: boolean
  authModalMessage: string | null
  pendingAction: PendingAction
  setFirebaseUser: (user: FirebaseUser | null) => void
  setProfile: (profile: AppUser | null) => void
  setLoading: (loading: boolean) => void
  openAuthModal: (message?: string, pendingAction?: PendingAction) => void
  closeAuthModal: () => void
  /** Run action if signed in and verified; otherwise open sign-in / verify UI. */
  requireAuth: (action: () => void, message?: string) => boolean
  runPendingAction: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  loading: true,
  isAuthModalOpen: false,
  authModalMessage: null,
  pendingAction: null,

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  openAuthModal: (message, pendingAction = null) =>
    set({
      isAuthModalOpen: true,
      authModalMessage: message ?? null,
      pendingAction,
    }),

  closeAuthModal: () =>
    set({ isAuthModalOpen: false, authModalMessage: null, pendingAction: null }),

  requireAuth: (action, message) => {
    const user = get().firebaseUser
    if (user) {
      if (needsEmailVerification(user)) {
        get().openAuthModal(
          'Verify your email before contributing. Check your inbox and spam folder.',
          action,
        )
        return false
      }
      action()
      return true
    }
    get().openAuthModal(
      message ?? 'Sign in to contribute accessibility reports.',
      action,
    )
    return false
  },

  runPendingAction: () => {
    const user = get().firebaseUser
    if (needsEmailVerification(user)) return

    const action = get().pendingAction
    set({ pendingAction: null, isAuthModalOpen: false, authModalMessage: null })
    action?.()
  },
}))
