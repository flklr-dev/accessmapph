import { MapPin } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export function LocationConfirmModal() {
  const isOpen = useMapStore((s) => s.isLocationConfirmOpen)
  const confirmLocationId = useMapStore((s) => s.confirmLocationId)
  const locations = useMapStore((s) => s.locations)
  const closeLocationConfirm = useMapStore((s) => s.closeLocationConfirm)
  const openReportModal = useMapStore((s) => s.openReportModal)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const requireAuth = useAuthStore((s) => s.requireAuth)

  const location = locations.find((l) => l.id === confirmLocationId)

  if (!location) return null

  const handleConfirm = () => {
    requireAuth(() => {
      openReportModal(location.id)
      closeLocationConfirm()
    }, 'Sign in to report at this location.')
  }

  const handleViewOnly = () => {
    setSelectedLocation(location.id)
    closeLocationConfirm()
  }

  return (
    <Modal open={isOpen} onClose={closeLocationConfirm} title="Confirm location">
      <div className="space-y-4">
        <div className="p-4 rounded-md border border-border bg-bg-subtle">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted m-0 mb-2">
            Is this the place you want to report?
          </p>
          <p className="text-base font-semibold text-text m-0">{location.name}</p>
          <p className="text-sm text-text-muted m-0 mt-1">{location.address}</p>
          <p className="text-xs text-text-faint m-0 mt-2">
            {location.city} · {location.reports.length} existing report
            {location.reports.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 text-sm text-primary">
          <MapPin size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Reporting at an existing pin keeps all accessibility info in one place for other users.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={handleConfirm}>
            Yes — report at this location
          </Button>
          <Button variant="secondary" onClick={handleViewOnly}>
            View details first
          </Button>
          <Button variant="ghost" onClick={closeLocationConfirm}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
