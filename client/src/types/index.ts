export type AccessibilityStatus = 'accessible' | 'partial' | 'inaccessible' | 'unverified'

export type FeatureType =
  | 'ramp'
  | 'elevator'
  | 'restroom'
  | 'parking'
  | 'pathway'
  | 'signage'

export type DisabilityType = 'mobility' | 'visual' | 'hearing' | 'cognitive'

export type LocationCategory =
  | 'mall'
  | 'school'
  | 'government'
  | 'hospital'
  | 'transport'
  | 'other'

export type ReportStatus = 'accessible' | 'partial' | 'inaccessible'

export type AIVerdict = 'approved' | 'flagged' | 'pending'

export interface Report {
  id: string
  locationId: string
  featureType: FeatureType
  status: AccessibilityStatus
  description?: string
  upvotes: number
  downvotes: number
  verified: boolean
  aiVerdict?: AIVerdict
  createdAt: string
}

export interface SubmitReportInput {
  locationId: string
  featureType: FeatureType
  status: ReportStatus
  description?: string
}

export interface ModerationResult {
  valid: boolean
  reason: string
  confidence: number
}

export interface SubmitReportResponse {
  report: Report
  moderation: ModerationResult
}

export type LocationSource = 'seed' | 'community'

export interface Location {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  category: LocationCategory
  city: string
  geohash?: string
  placeKey?: string | null
  source?: LocationSource
  reports: Report[]
}

export type ResolveAction = 'matched' | 'nearby' | 'new'

export type MatchReason = 'place_key' | 'proximity' | 'strong_proximity'

export interface LocationCandidate {
  location: Location
  distanceMeters: number
  matchReason: MatchReason
}

export interface LocationSuggestion {
  name: string
  address: string
  city: string
  placeKey: string | null
}

export interface ResolveLocationResponse {
  action: ResolveAction
  tap: { lat: number; lng: number }
  location?: Location
  distanceMeters?: number
  matchReason?: MatchReason
  candidates?: LocationCandidate[]
  suggestion?: LocationSuggestion
}

export interface CreateLocationInput {
  lat: number
  lng: number
  name: string
  address?: string
  city?: string
  category?: LocationCategory
  placeKey?: string | null
  forceNew?: boolean
}

export interface PlaceSearchResult {
  name: string
  address: string
  city: string
  lat: number
  lng: number
  placeKey: string | null
}

export interface PlaceSearchResponse {
  onMap: Location[]
  places: PlaceSearchResult[]
}

export const FEATURE_LABELS: Record<FeatureType, string> = {
  ramp: 'Ramp',
  elevator: 'Elevator',
  restroom: 'Restroom',
  parking: 'Parking',
  pathway: 'Pathway',
  signage: 'Signage',
}

export const STATUS_LABELS: Record<AccessibilityStatus, string> = {
  accessible: 'Accessible',
  partial: 'Partial',
  inaccessible: 'Inaccessible',
  unverified: 'Unverified',
}

export const REPORT_STATUS_OPTIONS: ReportStatus[] = [
  'accessible',
  'partial',
  'inaccessible',
]

export const FEATURE_OPTIONS: FeatureType[] = [
  'ramp',
  'elevator',
  'restroom',
  'parking',
  'pathway',
  'signage',
]

export const DISABILITY_LABELS: Record<DisabilityType, string> = {
  mobility: 'Mobility',
  visual: 'Visual',
  hearing: 'Hearing',
  cognitive: 'Cognitive',
}
