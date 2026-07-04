import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { fetchCurrentUser } from '../api/auth'
import { setAuthSessionUser } from '../lib/authSession'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'

/** Subscribe to Firebase auth and sync profile with the API. */
export function useAuthBootstrap() {
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setLoading = useAuthStore((s) => s.setLoading)
  const runPendingAction = useAuthStore((s) => s.runPendingAction)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false)
      return
    }

    const auth = getFirebaseAuth()
    let cancelled = false

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthSessionUser(user)
      setFirebaseUser(user)

      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const profile = await fetchCurrentUser()
        if (!cancelled) {
          setProfile(profile)
          runPendingAction()
        }
      } catch {
        if (!cancelled) setProfile(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setFirebaseUser, setProfile, setLoading, runPendingAction])
}
