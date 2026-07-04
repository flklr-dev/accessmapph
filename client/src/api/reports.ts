import type { SubmitReportInput, SubmitReportResponse } from '../types'

const DESCRIPTION_MAX = 280

export function validateReportInput(input: SubmitReportInput): string | null {
  if (!input.locationId) return 'Location is required.'
  if (!input.featureType) return 'Select a feature type.'
  if (!input.status) return 'Select an accessibility status.'
  if (input.description && input.description.length > DESCRIPTION_MAX) {
    return `Description must be ${DESCRIPTION_MAX} characters or fewer.`
  }
  return null
}

export async function submitReport(
  input: SubmitReportInput,
): Promise<SubmitReportResponse> {
  const validationError = validateReportInput(input)
  if (validationError) throw new Error(validationError)

  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to submit report.')
  }

  return response.json()
}

export { DESCRIPTION_MAX }
