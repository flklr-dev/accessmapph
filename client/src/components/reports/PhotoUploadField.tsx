import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ImagePlus, Loader2, X } from 'lucide-react'
import {
  confirmUpload,
  fetchUploadStatus,
  requestUploadSignature,
  uploadFileToCloudinary,
} from '../../api/uploads'
import { MAX_PHOTOS_PER_REPORT, validateImageFile } from '../../lib/imageValidation'
import { cn } from '../../lib/utils'

type ItemStatus = 'uploading' | 'confirming' | 'error'

interface PendingItem {
  id: string
  previewUrl: string
  status: ItemStatus
  progress: number
  error?: string
}

interface PhotoUploadFieldProps {
  photos: string[]
  onChange: (photos: string[]) => void
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}

/**
 * Direct-to-Cloudinary photo upload for report submissions.
 *
 * Security/scale model: the browser uploads bytes straight to Cloudinary
 * using a short-lived, per-user-scoped signature from our server (binary
 * traffic never touches our API). The returned asset is then verified
 * server-side (owner, size, format) before its URL is trusted anywhere —
 * see `server/src/lib/cloudinary.ts` for the corresponding checks.
 */
export function PhotoUploadField({
  photos,
  onChange,
  onBusyChange,
  disabled = false,
}: PhotoUploadFieldProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [pending, setPending] = useState<PendingItem[]>([])
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchUploadStatus()
      .then((status) => {
        if (!cancelled) setEnabled(status.enabled)
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const busy = pending.some((p) => p.status === 'uploading' || p.status === 'confirming')
    onBusyChange?.(busy)
  }, [pending, onBusyChange])

  const slotsUsed = photos.length + pending.filter((p) => p.status !== 'error').length
  const canAddMore = !disabled && slotsUsed < MAX_PHOTOS_PER_REPORT

  const uploadOne = useCallback(
    async (file: File) => {
      const validationError = validateImageFile(file)
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)

      if (validationError) {
        setPending((prev) => [
          ...prev,
          { id, previewUrl, status: 'error', progress: 0, error: validationError },
        ])
        return
      }

      setPending((prev) => [...prev, { id, previewUrl, status: 'uploading', progress: 0 }])

      try {
        const signature = await requestUploadSignature()
        const uploaded = await uploadFileToCloudinary(file, signature, (progress) => {
          setPending((prev) => prev.map((p) => (p.id === id ? { ...p, progress } : p)))
        })

        setPending((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'confirming', progress: 100 } : p)),
        )

        const confirmed = await confirmUpload(uploaded.publicId)

        setPending((prev) => prev.filter((p) => p.id !== id))
        URL.revokeObjectURL(previewUrl)
        onChange([...photos, confirmed.url])
      } catch (err) {
        setPending((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Upload failed.',
                }
              : p,
          ),
        )
      }
    },
    [photos, onChange],
  )

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return
      const remaining = MAX_PHOTOS_PER_REPORT - slotsUsed
      const files = Array.from(fileList).slice(0, Math.max(0, remaining))
      files.forEach((file) => void uploadOne(file))
    },
    [disabled, slotsUsed, uploadOne],
  )

  const removePhoto = (url: string) => {
    onChange(photos.filter((p) => p !== url))
  }

  const dismissError = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  // Not configured server-side — hide the feature entirely rather than show a broken control.
  if (enabled === false) return null

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-text">
        Photos <span className="font-normal text-text-muted">(optional)</span>
      </label>
      <p className="text-sm text-text-muted m-0">
        Up to {MAX_PHOTOS_PER_REPORT} photos, 5MB each. Helps others verify the condition.
      </p>

      <div className="flex flex-wrap gap-2.5">
        {photos.map((url) => (
          <div
            key={url}
            className="relative w-20 h-20 rounded-md overflow-hidden border border-border shrink-0 group"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              disabled={disabled}
              aria-label="Remove photo"
              className={cn(
                'absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full',
                'bg-black/60 text-white hover:bg-black/80 cursor-pointer border-0 transition-colors',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}

        {pending.map((item) => (
          <div
            key={item.id}
            className={cn(
              'relative w-20 h-20 rounded-md overflow-hidden border shrink-0',
              item.status === 'error' ? 'border-red-500' : 'border-border',
            )}
          >
            <img src={item.previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              {item.status === 'error' ? (
                <AlertCircle size={20} className="text-white" aria-hidden="true" />
              ) : (
                <Loader2 size={20} className="text-white animate-spin" aria-hidden="true" />
              )}
            </div>
            {item.status === 'error' ? (
              <button
                type="button"
                onClick={() => dismissError(item.id)}
                aria-label="Dismiss failed upload"
                className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer border-0"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : (
              <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-semibold text-white drop-shadow">
                {item.status === 'confirming' ? 'Verifying…' : `${item.progress}%`}
              </span>
            )}
          </div>
        ))}

        {canAddMore && (
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleFiles(e.dataTransfer.files)
            }}
            className={cn(
              'w-20 h-20 rounded-md border-2 border-dashed shrink-0 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors',
              isDragging
                ? 'border-primary bg-blue-50'
                : 'border-border bg-white hover:border-gray-400 hover:bg-surface-1',
            )}
          >
            <ImagePlus size={18} className="text-text-muted" aria-hidden="true" />
            <span className="text-[10px] font-medium text-text-muted">Add</span>
          </label>
        )}
      </div>

      {pending.some((p) => p.status === 'error') && (
        <p className="text-sm text-red-500 m-0" role="alert">
          {pending.find((p) => p.status === 'error')?.error}
        </p>
      )}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={!canAddMore}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
        className="sr-only"
      />
    </div>
  )
}
