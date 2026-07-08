import { useEffect, useState } from 'react'
import { Loader2, MapPin, AlertCircle, Waves } from 'lucide-react'
import {
  createLocation,
  resolveLocationWithFallback,
} from '../../api/locations'
import { useMapStore } from '../../store/mapStore'
import type { Location, ResolveLocationResponse } from '../../types'
import { formatDistance } from '../../lib/geo'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { cn } from '../../lib/utils'

const inputClass =
  'w-full px-3 py-2 text-base text-text bg-white border border-border rounded-md transition-colors hover:border-gray-400 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--color-blue-50)]'

export function PinConfirmModal() {
  const mapTap = useMapStore((s) => s.mapTap)
  const isOpen = useMapStore((s) => s.isPinModalOpen)
  const locationConfirmPrefill = useMapStore((s) => s.locationConfirmPrefill)
  const locations = useMapStore((s) => s.locations)
  const closePinFlow = useMapStore((s) => s.closePinFlow)
  const upsertLocation = useMapStore((s) => s.upsertLocation)
  const openReportModal = useMapStore((s) => s.openReportModal)
  const showToast = useMapStore((s) => s.showToast)

  const [resolveResult, setResolveResult] = useState<ResolveLocationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceNew, setForceNew] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    if (!isOpen || !mapTap) return

    setLoading(true)
    setError(null)
    setResolveResult(null)
    setForceNew(false)
    setSelectedCandidateId(null)

    resolveLocationWithFallback(mapTap.lat, mapTap.lng, locations)
      .then((result) => {
        setResolveResult(result)
        const suggestion = locationConfirmPrefill ?? result.suggestion
        if (suggestion) {
          setName(suggestion.name)
          setAddress(suggestion.address)
          setCity(suggestion.city)
        }
        if (result.action === 'nearby' && result.candidates?.length) {
          setSelectedCandidateId(result.candidates[0].location.id)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not resolve location.')
      })
      .finally(() => setLoading(false))
  }, [isOpen, mapTap?.lat, mapTap?.lng, locationConfirmPrefill])

  const handleClose = () => {
    if (creating) return
    closePinFlow()
    setResolveResult(null)
    setError(null)
  }

  const proceedToReport = (location: Location, message?: string) => {
    upsertLocation(location)
    if (message) showToast(message, 'info')
    openReportModal(location.id)
  }

  const handleUseExisting = () => {
    if (!resolveResult?.location) return
    const msg =
      resolveResult.distanceMeters && resolveResult.distanceMeters > 0
        ? `Using existing pin ${formatDistance(resolveResult.distanceMeters)} away.`
        : undefined
    proceedToReport(resolveResult.location, msg)
  }

  const handleUseCandidate = () => {
    const candidate = resolveResult?.candidates?.find(
      (c) => c.location.id === selectedCandidateId,
    )
    if (!candidate) return
    proceedToReport(
      candidate.location,
      `Using existing pin ${formatDistance(candidate.distanceMeters)} away.`,
    )
  }

  const handleCreateNew = async () => {
    if (!mapTap || !resolveResult) return

    setCreating(true)
    setError(null)

    try {
      const created = await createLocation({
        lat: mapTap.lat,
        lng: mapTap.lng,
        name,
        address,
        city,
        placeKey: resolveResult.suggestion?.placeKey ?? null,
        forceNew,
      })

      proceedToReport(created, 'New location added to the map.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create location.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const showNewPlaceForm =
    resolveResult?.action === 'new' || forceNew

  return (
    <Modal open={isOpen && mapTap !== null} onClose={handleClose} title="Confirm location">
      {locationConfirmPrefill && !loading && resolveResult?.action !== 'invalid' && (
        <p className="text-sm text-text-muted m-0 mb-4">
          You searched for this place. Confirm it matches before reporting — we&apos;ll check for
          existing pins nearby to avoid duplicates.
        </p>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-text-muted py-4" role="status">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
          Checking for existing locations nearby…
        </div>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 mb-4 rounded-md bg-red-50 text-sm text-red-500"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </div>
      )}

      {resolveResult && !loading && (
        <>
          {resolveResult.action === 'invalid' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-md bg-amber-50 text-amber-900">
                {resolveResult.reason === 'ocean' ? (
                  <Waves size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertCircle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-semibold m-0">
                    {resolveResult.reason === 'ocean'
                      ? "That's open water"
                      : "That's outside the Philippines"}
                  </p>
                  <p className="text-sm m-0 mt-1 text-amber-800">
                    {resolveResult.message ??
                      'Pick a spot within the Philippines to add a pin.'}
                  </p>
                </div>
              </div>
              <Button variant="secondary" className="w-full" onClick={handleClose}>
                Choose another spot
              </Button>
            </div>
          )}

          {resolveResult.action === 'matched' && !forceNew && (
            <div className="space-y-4">
              <div className="p-4 rounded-md border border-border bg-bg-subtle">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0 mb-2">
                  Existing location found
                </p>
                <p className="text-base font-semibold text-text m-0">
                  {resolveResult.location?.name}
                </p>
                <p className="text-sm text-text-muted m-0 mt-1">
                  {resolveResult.location?.address}
                </p>
                {resolveResult.distanceMeters !== undefined &&
                  resolveResult.matchReason !== 'place_key' && (
                    <p className="text-xs text-text-faint m-0 mt-2">
                      {formatDistance(resolveResult.distanceMeters)} from your tap
                    </p>
                  )}
                {resolveResult.matchReason === 'place_key' && (
                  <p className="text-xs text-text-faint m-0 mt-2">
                    Matched by map place ID — same building
                  </p>
                )}
              </div>

              <p className="text-sm text-text-muted m-0">
                Reports at this spot go to the same pin so everyone sees one place.
              </p>

              <div className="flex flex-col gap-2">
                <Button variant="primary" onClick={handleUseExisting}>
                  Report at this location
                </Button>
                <Button variant="ghost" onClick={() => setForceNew(true)}>
                  No — this is a different place
                </Button>
              </div>
            </div>
          )}

          {resolveResult.action === 'nearby' && !forceNew && resolveResult.candidates && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted m-0">
                Multiple locations are near your tap. Pick the correct one so reports stay
                together.
              </p>

              <ul className="space-y-2 m-0 p-0 list-none" role="listbox" aria-label="Nearby locations">
                {resolveResult.candidates.map((candidate) => (
                  <li key={candidate.location.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCandidateId === candidate.location.id}
                      onClick={() => setSelectedCandidateId(candidate.location.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-md border cursor-pointer transition-colors',
                        selectedCandidateId === candidate.location.id
                          ? 'border-primary bg-blue-50'
                          : 'border-border bg-white hover:border-gray-400',
                      )}
                    >
                      <span className="block text-sm font-semibold text-text">
                        {candidate.location.name}
                      </span>
                      <span className="block text-xs text-text-muted mt-0.5">
                        {formatDistance(candidate.distanceMeters)} away · {candidate.location.city}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  onClick={handleUseCandidate}
                  disabled={!selectedCandidateId}
                >
                  Report at selected location
                </Button>
                <Button variant="ghost" onClick={() => setForceNew(true)}>
                  None of these — add new place
                </Button>
              </div>
            </div>
          )}

          {showNewPlaceForm && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 text-sm text-primary">
                <MapPin size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {forceNew
                    ? 'Adding a separate pin. Keep pins at least 15 m apart when possible.'
                    : 'No existing pin nearby. Name this place so others can find it.'}
                </span>
              </div>

              <Field label="Place name" htmlFor="pin-name" hint="Required">
                <input
                  id="pin-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={creating}
                  className={inputClass}
                  placeholder="e.g. SM Mall of Asia"
                />
              </Field>

              <Field label="Address" htmlFor="pin-address">
                <input
                  id="pin-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={creating}
                  className={inputClass}
                />
              </Field>

              <Field label="City" htmlFor="pin-city">
                <input
                  id="pin-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={creating}
                  className={inputClass}
                />
              </Field>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                {(resolveResult.action === 'matched' ||
                  resolveResult.action === 'nearby') && (
                  <Button variant="secondary" onClick={() => setForceNew(false)} disabled={creating}>
                    Back
                  </Button>
                )}
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCreateNew}
                  disabled={creating || name.trim().length < 2}
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Creating…
                    </>
                  ) : (
                    'Add place & report'
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
