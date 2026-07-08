import type {
  AccessibilityStatus,
  DisabilityType,
  FeatureType,
  Location,
  Report,
} from '../types'

export const DISABILITY_FEATURE_MAP: Record<DisabilityType, FeatureType[]> = {
  mobility: ['ramp', 'elevator', 'parking', 'pathway'],
  visual: ['signage', 'pathway', 'elevator'],
  hearing: ['signage'],
  cognitive: ['signage', 'pathway'],
}

function worstStatus(reports: Report[]): AccessibilityStatus {
  if (reports.length === 0) return 'unverified'
  const priority: AccessibilityStatus[] = [
    'inaccessible',
    'partial',
    'unverified',
    'accessible',
  ]
  for (const status of priority) {
    if (reports.some((r) => r.status === status)) return status
  }
  return 'unverified'
}

function getMatchingReports(
  location: Location,
  featureFilters: FeatureType[],
  disabilityFilters: DisabilityType[],
): Report[] {
  // Flagged reports (hard-failed rules or hidden by community votes/flags)
  // never count toward the location's displayed status.
  let reports = location.reports.filter((r) => r.aiVerdict !== 'flagged')

  if (featureFilters.length > 0) {
    reports = reports.filter((r) => featureFilters.includes(r.featureType))
  }

  if (disabilityFilters.length > 0) {
    const allowed = new Set<FeatureType>()
    disabilityFilters.forEach((d) =>
      DISABILITY_FEATURE_MAP[d].forEach((f) => allowed.add(f)),
    )
    reports = reports.filter((r) => allowed.has(r.featureType))
  }

  return reports
}

export function getLocationStatus(
  location: Location,
  featureFilters: FeatureType[],
  disabilityFilters: DisabilityType[],
): AccessibilityStatus {
  return worstStatus(getMatchingReports(location, featureFilters, disabilityFilters))
}

export function filterLocations(
  locations: Location[],
  featureFilters: FeatureType[],
  disabilityFilters: DisabilityType[],
  searchQuery: string,
): Location[] {
  const query = searchQuery.trim().toLowerCase()

  return locations.filter((location) => {
    if (query) {
      const matchesSearch =
        location.name.toLowerCase().includes(query) ||
        location.address.toLowerCase().includes(query) ||
        location.city.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    const reports = getMatchingReports(location, featureFilters, disabilityFilters)

    if (featureFilters.length > 0 || disabilityFilters.length > 0) {
      return reports.length > 0
    }

    return true
  })
}

export function countActiveFilters(
  featureFilters: FeatureType[],
  disabilityFilters: DisabilityType[],
): number {
  return featureFilters.length + disabilityFilters.length
}
