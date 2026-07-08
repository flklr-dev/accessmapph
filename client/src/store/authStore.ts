import { create } from 'zustand'
import type { User as FirebaseUser } from 'firebase/auth'
import type { AppUser } from '../types/auth'
import { needsEmailVerification } from '../lib/authActions'

type PendingAction = (() => void) | null

interface AuthState {
  firebaseUser: FirebaseUser | null
  profile: AppUser | null
  /** Report IDs authored by the signed-in user (server no longer exposes author UIDs publicly). */
  myReportIds: Set<string>
  loading: boolean
  isAuthModalOpen: boolean
  authModalMessage: string | null
  isProfileModalOpen: boolean
  pendingAction: PendingAction
  setFirebaseUser: (user: FirebaseUser | null) => void
  setProfile: (profile: AppUser | null) => void
  setMyReportIds: (ids: string[]) => void
  addMyReportId: (id: string) => void
  setLoading: (loading: boolean) => void
  openAuthModal: (message?: string, pendingAction?: PendingAction) => void
  closeAuthModal: () => void
  openProfileModal: () => void
  closeProfileModal: () => void
  /** Run action if signed in and verified; otherwise open sign-in / verify UI. */
  requireAuth: (action: () => void, message?: string) => boolean
  runPendingAction: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  myReportIds: new Set(),
  loading: true,
  isAuthModalOpen: false,
  authModalMessage: null,
  isProfileModalOpen: false,
  pendingAction: null,

  setFirebaseUser: (user) =>
    set(
      user
        ? { firebaseUser: user }
        : { firebaseUser: null, profile: null, myReportIds: new Set(), isProfileModalOpen: false },
    ),
  setProfile: (profile) => set({ profile }),
  setMyReportIds: (ids) => set({ myReportIds: new Set(ids) }),
  addMyReportId: (id) =>
    set((state) => {
      const next = new Set(state.myReportIds)
      next.add(id)
      return { myReportIds: next }
    }),
  setLoading: (loading) => set({ loading }),

  openAuthModal: (message, pendingAction = null) =>
    set({
      isAuthModalOpen: true,
      authModalMessage: message ?? null,
      pendingAction,
    }),

  closeAuthModal: () =>
    set({ isAuthModalOpen: false, authModalMessage: null, pendingAction: null }),

  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),

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
