import type { SubmitReportInput, SubmitReportResponse } from '../types'
import { apiFetch } from './http'

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

  return apiFetch<SubmitReportResponse>('/api/reports', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

export { DESCRIPTION_MAX }
