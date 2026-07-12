import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { submitFeedback } from '../../api/feedback'
import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPE_OPTIONS,
  type FeedbackType,
} from '../../types/feedback'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/Field'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

const textareaClass =
  'w-full px-3 py-2 text-base text-text bg-white border border-border rounded-md transition-colors hover:border-gray-400 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--color-blue-50)] resize-y min-h-[120px]'

export function FeedbackModal() {
  const isOpen = useAuthStore((s) => s.isFeedbackModalOpen)
  const closeFeedbackModal = useAuthStore((s) => s.closeFeedbackModal)
  const showToast = useMapStore((s) => s.showToast)

  const [type, setType] = useState<FeedbackType>('suggestion')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setType('suggestion')
    setMessage('')
    setError(null)
    setSubmitting(false)
  }, [isOpen])

  const handleClose = () => {
    if (submitting) return
    closeFeedbackModal()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const trimmed = message.trim()
    if (trimmed.length < FEEDBACK_MESSAGE_MIN) {
      setError(`Please write at least ${FEEDBACK_MESSAGE_MIN} characters.`)
      return
    }
    if (trimmed.length > FEEDBACK_MESSAGE_MAX) {
      setError(`Maximum ${FEEDBACK_MESSAGE_MAX} characters.`)
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await submitFeedback({
        type,
        message: trimmed,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      })
      showToast('Thanks — your feedback was sent!', 'success')
      closeFeedbackModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = FEEDBACK_MESSAGE_MAX - message.length

  return (
    <Modal open={isOpen} onClose={handleClose} title="Send feedback">
      <p className="text-sm text-text-muted m-0 mb-4">
        Share a suggestion, report a problem, or tell us what would make AccessMap PH better for
        you.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Type" htmlFor="feedback-type">
          <div
            id="feedback-type"
            role="radiogroup"
            aria-label="Feedback type"
            className="flex flex-wrap gap-2"
          >
            {FEEDBACK_TYPE_OPTIONS.map((option) => {
              const selected = type === option
              return (
                <label
                  key={option}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium cursor-pointer transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-white text-text hover:border-gray-400',
                  )}
                >
                  <input
                    type="radio"
                    name="feedback-type"
                    value={option}
                    checked={selected}
                    onChange={() => setType(option)}
                    className="sr-only"
                  />
                  {FEEDBACK_TYPE_LABELS[option]}
                </label>
              )
            })}
          </div>
        </Field>

        <Field
          label="Your message"
          htmlFor="feedback-message"
          hint={`At least ${FEEDBACK_MESSAGE_MIN} characters.`}
          error={error ?? undefined}
        >
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. It would help if search showed wheelchair routes, or the map felt slow on my phone…"
            maxLength={FEEDBACK_MESSAGE_MAX}
            className={textareaClass}
            disabled={submitting}
            required
          />
          <p className="text-xs text-text-muted m-0 mt-1 text-right" aria-live="polite">
            {remaining} characters left
          </p>
        </Field>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || message.trim().length < FEEDBACK_MESSAGE_MIN}>
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              'Send feedback'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
