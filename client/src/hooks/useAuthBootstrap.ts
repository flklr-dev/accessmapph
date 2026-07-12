import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { fetchCurrentUserState } from '../api/auth'
import { setAuthSessionUser } from '../lib/authSession'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'

/** Subscribe to Firebase auth and sync profile with the API. */
export function useAuthBootstrap() {
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setMyReportIds = useAuthStore((s) => s.setMyReportIds)
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
        setMyReportIds([])
        setLoading(false)
        return
      }

      try {
        const { user: profile, reportIds } = await fetchCurrentUserState()
        if (!cancelled) {
          setProfile(profile)
          setMyReportIds(reportIds)
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
  }, [setFirebaseUser, setProfile, setMyReportIds, setLoading, runPendingAction])
}
