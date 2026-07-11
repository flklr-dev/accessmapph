import { useEffect, useState } from 'react'
import { AlertTriangle, Award, Loader2, MapPin, Trash2 } from 'lucide-react'
import { fetchMyContributions } from '../../api/auth'
import { fetchLocationById, fetchLocations } from '../../api/locations'
import { deleteAccount, isPasswordUser } from '../../lib/authActions'
import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import {
  LEVEL_LABELS,
  nextLevelInfo,
  type UserContribution,
} from '../../types/auth'
import { FEATURE_LABELS, STATUS_LABELS } from '../../types'
import { Modal } from '../ui/Modal'
import { StatusBadge } from '../ui/StatusBadge'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ProfileModal() {
  const isOpen = useAuthStore((s) => s.isProfileModalOpen)
  const closeProfileModal = useAuthStore((s) => s.closeProfileModal)
  const profile = useAuthStore((s) => s.profile)
  const firebaseUser = useAuthStore((s) => s.firebaseUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setMyReportIds = useAuthStore((s) => s.setMyReportIds)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const setMobilePanelOpen = useMapStore((s) => s.setMobilePanelOpen)
  const setLocations = useMapStore((s) => s.setLocations)
  const showToast = useMapStore((s) => s.showToast)

  const [contributions, setContributions] = useState<UserContribution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !firebaseUser) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchMyContributions()
        if (cancelled) return
        setProfile(data.user)
        setContributions(data.contributions)
        setMyReportIds(data.contributions.map((c) => c.id))
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [isOpen, firebaseUser, setProfile, setMyReportIds])

  const handleClose = () => {
    setShowDeleteConfirm(false)
    setDeleteConfirmText('')
    setDeletePassword('')
    setDeleteError(null)
    closeProfileModal()
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    setDeleting(true)
    setDeleteError(null)

    try {
      await deleteAccount(isPasswordUser(firebaseUser) ? deletePassword : undefined)
      try {
        const locations = await fetchLocations({ city: useMapStore.getState().activeSpace })
        setLocations(locations)
      } catch {
        // Map will refresh on next load
      }
      showToast('Your account has been permanently deleted.', 'info')
      handleClose()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete account.')
    } finally {
      setDeleting(false)
    }
  }

  const openLocation = async (locationId: string) => {
    const existing = useMapStore.getState().locations.find((l) => l.id === locationId)
    if (!existing) {
      try {
        const detail = await fetchLocationById(locationId)
        useMapStore.getState().upsertLocation({ ...detail, reportsLoaded: true })
      } catch {
        showToast('That location is not available right now.', 'error')
        return
      }
    } else {
      setSelectedLocation(locationId)
    }
    setMobilePanelOpen(true)
    closeProfileModal()
  }

  if (!firebaseUser) return null

  const displayName =
    profile?.displayName || firebaseUser.displayName || 'Contributor'
  const photo = profile?.photoURL || firebaseUser.photoURL
  const level = profile?.level ?? 'newcomer'
  const points = profile?.points ?? 0
  const reportCount = profile?.reportCount ?? contributions.length
  const levelProgress = nextLevelInfo(points, level)

  return (
    <Modal open={isOpen} onClose={handleClose} title="Your profile" className="max-w-lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3.5">
          <div className="w-14 h-14 rounded-lg border border-border overflow-hidden shrink-0 bg-surface-1 flex items-center justify-center">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-display font-extrabold text-ink m-0 truncate">
              {displayName}
            </h3>
            <p className="text-sm text-ink-muted m-0 truncate">
              {profile?.email || firebaseUser.email}
            </p>
            {profile?.createdAt && (
              <p className="text-[11px] text-gray-400 m-0 mt-1">
                Joined {formatDate(profile.createdAt)}
              </p>
            )}
          </div>
          {!showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 bg-transparent border-0 cursor-pointer"
              aria-label="Delete account"
              title="Delete account"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="rounded-md border border-red-500/25 bg-red-50 p-3.5 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-red-600 m-0">Delete your account?</p>
                <p className="text-[13px] leading-relaxed text-red-600/90 m-0 mt-1">
                  This permanently removes your profile, points, and reports. Photos you uploaded
                  will be deleted. Accessibility reports from other contributors stay on the map.
                  This cannot be undone.
                </p>
              </div>
            </div>

            <label htmlFor="delete-confirm" className="block text-xs font-medium text-ink m-0">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value)
                if (deleteError) setDeleteError(null)
              }}
              disabled={deleting}
              autoComplete="off"
              className="w-full px-3 py-2 text-sm text-ink bg-white border border-border rounded-md focus:outline-none focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(185,28,28,0.08)]"
              placeholder="DELETE"
            />

            {isPasswordUser(firebaseUser) && (
              <>
                <label htmlFor="delete-password" className="block text-xs font-medium text-ink m-0">
                  Current password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value)
                    if (deleteError) setDeleteError(null)
                  }}
                  disabled={deleting}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 text-sm text-ink bg-white border border-border rounded-md focus:outline-none focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(185,28,28,0.08)]"
                  placeholder="Your password"
                />
              </>
            )}

            {deleteError && (
              <p className="text-sm text-red-500 m-0" role="alert">
                {deleteError}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                  setDeletePassword('')
                  setDeleteError(null)
                }}
                disabled={deleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteAccount}
                disabled={
                  deleting ||
                  deleteConfirmText !== 'DELETE' ||
                  (isPasswordUser(firebaseUser) && !deletePassword.trim())
                }
                className="flex-1 bg-red-500! hover:bg-red-600! focus-visible:ring-red-500!"
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    Deleting?
                  </>
                ) : (
                  'Delete my account'
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border bg-surface-1 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted m-0">
              Level
            </p>
            <p className="text-sm font-semibold text-ink m-0 mt-0.5 flex items-center gap-1">
              <Award size={14} className="text-primary shrink-0" aria-hidden="true" />
              {LEVEL_LABELS[level]}
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface-1 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted m-0">
              Points
            </p>
            <p className="text-sm font-semibold text-ink m-0 mt-0.5">{points}</p>
          </div>
          <div className="rounded-md border border-border bg-surface-1 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted m-0">
              Reports
            </p>
            <p className="text-sm font-semibold text-ink m-0 mt-0.5">{reportCount}</p>
          </div>
        </div>

        {levelProgress.next && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-xs text-ink-muted m-0">
                Progress to {LEVEL_LABELS[levelProgress.next]}
              </p>
              <p className="text-xs font-medium text-ink m-0">
                {levelProgress.pointsToNext} pts left
              </p>
            </div>
            <div
              className="h-1.5 rounded-full bg-surface-1 border border-border overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(levelProgress.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress to ${LEVEL_LABELS[levelProgress.next]}`}
            >
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-300"
                style={{ width: `${Math.round(levelProgress.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted m-0 mb-3">
            Contribution history
          </h4>

          {loading ? (
            <div
              className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted"
              role="status"
            >
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Loading contributions?
            </div>
          ) : error ? (
            <p
              className="text-sm text-red-500 m-0 leading-relaxed px-3 py-2.5 rounded-md bg-red-50 border border-red-500/20"
              role="alert"
            >
              {error}
            </p>
          ) : contributions.length === 0 ? (
            <EmptyState
              title="No contributions yet"
              description="Report accessibility at a place on the map to build your history."
            />
          ) : (
            <ul className="m-0 p-0 list-none space-y-2.5 max-h-[40vh] overflow-y-auto">
              {contributions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openLocation(item.locationId)}
                    className="w-full text-left border border-border rounded-md p-3 bg-white hover:bg-surface-1 hover:border-gray-400 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink m-0 truncate flex items-center gap-1.5">
                          <MapPin size={13} className="text-primary shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.locationName}</span>
                        </p>
                        <p className="text-[11px] text-ink-muted m-0 mt-0.5">
                          {item.locationCity} ? {FEATURE_LABELS[item.featureType]}
                        </p>
                      </div>
                      <StatusBadge status={item.status} verified={item.verified} />
                    </div>

                    {item.description && (
                      <p className="text-xs text-ink-muted m-0 mb-2 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {item.photos.length > 0 && (
                      <div className="flex gap-1.5 mb-2">
                        {item.photos.map((url) => (
                          <img
                            key={url}
                            src={url}
                            alt="Reported condition"
                            loading="lazy"
                            className="w-10 h-10 rounded-sm object-cover border border-border shrink-0"
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.aiVerdict === 'flagged' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm bg-red-50 text-red-500">
                          Flagged
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {STATUS_LABELS[item.status]} ? {formatDate(item.createdAt)} ? {item.upvotes}{' '}
                        confirmation{item.upvotes !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
