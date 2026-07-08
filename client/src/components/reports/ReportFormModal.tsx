import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { submitReport, DESCRIPTION_MAX } from '../../api/reports'
import { useMapStore } from '../../store/mapStore'
import {
  FEATURE_LABELS,
  FEATURE_OPTIONS,
  REPORT_STATUS_OPTIONS,
  STATUS_LABELS,
  type FeatureType,
  type ReportStatus,
} from '../../types'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { Button } from '../ui/Button'
import { PhotoUploadField } from './PhotoUploadField'
import { cn } from '../../lib/utils'

const inputClass =
  'w-full px-3 py-2 text-base text-text bg-white border border-border rounded-md transition-colors hover:border-gray-400 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--color-blue-50)]'

const statusHint: Record<ReportStatus, string> = {
  accessible: 'Fully usable without barriers',
  partial: 'Usable with some difficulty',
  inaccessible: 'Not usable or blocked',
}

export function ReportFormModal() {
  const reportModalLocationId = useMapStore((s) => s.reportModalLocationId)
  const locations = useMapStore((s) => s.locations)
  const isSubmitting = useMapStore((s) => s.isSubmittingReport)
  const closeReportModal = useMapStore((s) => s.closeReportModal)
  const setSubmittingReport = useMapStore((s) => s.setSubmittingReport)
  const addReport = useMapStore((s) => s.addReport)
  const showToast = useMapStore((s) => s.showToast)

  const location = locations.find((l) => l.id === reportModalLocationId)

  const [featureType, setFeatureType] = useState<FeatureType>('ramp')
  const [status, setStatus] = useState<ReportStatus>('accessible')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [photosUploading, setPhotosUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setFeatureType('ramp')
    setStatus('accessible')
    setDescription('')
    setPhotos([])
    setPhotosUploading(false)
    setErrors({})
  }

  const handleClose = () => {
    if (isSubmitting) return
    resetForm()
    closeReportModal()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!location || isSubmitting || photosUploading) return

    const fieldErrors: Record<string, string> = {}
    if (!featureType) fieldErrors.featureType = 'Select a feature type.'
    if (!status) fieldErrors.status = 'Select an accessibility status.'
    if (description.length > DESCRIPTION_MAX) {
      fieldErrors.description = `Maximum ${DESCRIPTION_MAX} characters.`
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setSubmittingReport(true)

    try {
      const result = await submitReport({
        locationId: location.id,
        featureType,
        status,
        description: description.trim() || undefined,
        photos,
      })

      addReport(location.id, result.report)

      if (result.moderation.verdict === 'approved') {
        showToast(
          `Report published for ${FEATURE_LABELS[featureType]} at ${location.name}.`,
          'success',
        )
      } else if (result.moderation.verdict === 'pending') {
        showToast(
          `Report is visible and awaiting community confirmation.`,
          'info',
        )
      } else {
        showToast(
          `Report flagged automatically: ${result.moderation.reason}`,
          'error',
        )
      }

      resetForm()
      closeReportModal()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not submit report. Try again.',
        'error',
      )
    } finally {
      setSubmittingReport(false)
    }
  }

  if (!location) return null

  return (
    <Modal
      open={reportModalLocationId !== null}
      onClose={handleClose}
      title="Report Accessibility"
    >
      <p className="text-sm text-text-muted m-0 mb-6 -mt-2">
        Reporting at <strong className="text-text font-medium">{location.name}</strong>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Feature type"
          htmlFor="feature-type"
          hint="What accessibility feature are you reporting?"
          error={errors.featureType}
          className="mb-6"
        >
          <select
            id="feature-type"
            value={featureType}
            onChange={(e) => setFeatureType(e.target.value as FeatureType)}
            disabled={isSubmitting}
            aria-invalid={!!errors.featureType}
            className={cn(inputClass, 'cursor-pointer')}
          >
            {FEATURE_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {FEATURE_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>

        <fieldset className="border-0 p-0 m-0 mb-6">
          <legend className="text-sm font-semibold text-text mb-1">
            Accessibility status
          </legend>
          <p className="text-sm text-text-muted m-0 mb-3">
            How accessible is this feature right now?
          </p>
          {errors.status && (
            <p role="alert" className="text-sm text-red-500 m-0 mb-2">
              {errors.status}
            </p>
          )}
          <div className="space-y-2" role="radiogroup" aria-label="Accessibility status">
            {REPORT_STATUS_OPTIONS.map((option) => (
              <label
                key={option}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                  status === option
                    ? 'border-primary bg-blue-50'
                    : 'border-border bg-white hover:border-gray-400',
                  isSubmitting && 'opacity-60 cursor-not-allowed',
                )}
              >
                <input
                  type="radio"
                  name="status"
                  value={option}
                  checked={status === option}
                  onChange={() => setStatus(option)}
                  disabled={isSubmitting}
                  className="mt-1 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-text">
                    {STATUS_LABELS[option]}
                  </span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    {statusHint[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="Description"
          htmlFor="description"
          hint="Optional — describe the condition in plain terms."
          error={errors.description}
          className="mb-3"
        >
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            rows={4}
            maxLength={DESCRIPTION_MAX}
            placeholder="e.g. Ramp is steep and has no handrail on the left side."
            aria-invalid={!!errors.description}
            className={cn(inputClass, 'resize-y min-h-[96px]')}
          />
          <p
            className={cn(
              'text-xs text-right m-0 mt-1',
              description.length >= DESCRIPTION_MAX ? 'text-red-500' : 'text-text-faint',
            )}
            aria-live="polite"
          >
            {description.length}/{DESCRIPTION_MAX}
          </p>
        </Field>

        <div className="mb-6">
          <PhotoUploadField
            photos={photos}
            onChange={setPhotos}
            onBusyChange={setPhotosUploading}
            disabled={isSubmitting}
          />
        </div>

        {isSubmitting && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 text-sm text-primary mb-6"
            aria-busy="true"
            role="status"
          >
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Under review — checking your report…
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isSubmitting || photosUploading}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Submitting…
              </>
            ) : photosUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Uploading photos…
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
