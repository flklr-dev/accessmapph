import { create } from 'zustand'
import type { DisabilityType, FeatureType, Location, LocationSuggestion, Report } from '../types'
import { SEED_LOCATIONS } from '../data/seedLocations'
import { isWithinPhilippinesBounds } from '../lib/geo'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

export interface MapTap {
  lat: number
  lng: number
}

export interface SearchPlaceSelection {
  lat: number
  lng: number
  name: string
  address: string
  city: string
  placeKey: string | null
}

interface MapState {
  locations: Location[]
  selectedLocationId: string | null
  featureFilters: FeatureType[]
  disabilityFilters: DisabilityType[]
  searchQuery: string
  isMobilePanelOpen: boolean
  showMobileFilters: boolean
  reportModalLocationId: string | null
  isSubmittingReport: boolean
  toast: Toast | null
  mapTap: MapTap | null
  isPinModalOpen: boolean
  isFindPlaceModalOpen: boolean
  isLeaderboardOpen: boolean
  locationConfirmPrefill: LocationSuggestion | null
  setFindPlaceModalOpen: (open: boolean) => void
  openLeaderboard: () => void
  closeLeaderboard: () => void
  activeSpace: 'all' | 'manila' | 'cebu' | 'davao'
  setActiveSpace: (space: 'all' | 'manila' | 'cebu' | 'davao') => void
  mapOverviewEpoch: number
  requestMapOverview: () => void

  setLocations: (locations: Location[]) => void
  setSelectedLocation: (id: string | null) => void
  toggleFeatureFilter: (feature: FeatureType) => void
  toggleDisabilityFilter: (disability: DisabilityType) => void
  clearFilters: () => void
  setSearchQuery: (query: string) => void
  setMobilePanelOpen: (open: boolean) => void
  setShowMobileFilters: (show: boolean) => void
  openReportModal: (locationId: string) => void
  closeReportModal: () => void
  setSubmittingReport: (submitting: boolean) => void
  addReport: (locationId: string, report: Report) => void
  replaceReport: (locationId: string, report: Report) => void
  upsertLocation: (location: Location) => void
  showToast: (message: string, type: ToastType) => void
  clearToast: () => void
  setMapTap: (tap: MapTap) => void
  clearMapTap: () => void
  openPinModal: () => void
  closePinFlow: () => void
  startReportFromSearch: (place: SearchPlaceSelection) => void
}

export const useMapStore = create<MapState>((set, get) => ({
  locations: import.meta.env.DEV ? SEED_LOCATIONS : [],
  selectedLocationId: null,
  featureFilters: [],
  disabilityFilters: [],
  searchQuery: '',
  isMobilePanelOpen: true,
  showMobileFilters: false,
  reportModalLocationId: null,
  isSubmittingReport: false,
  toast: null,
  mapTap: null,
  isPinModalOpen: false,
  isFindPlaceModalOpen: false,
  isLeaderboardOpen: false,
  locationConfirmPrefill: null,
  setFindPlaceModalOpen: (open) => set({ isFindPlaceModalOpen: open }),
  openLeaderboard: () => set({ isLeaderboardOpen: true }),
  closeLeaderboard: () => set({ isLeaderboardOpen: false }),
  activeSpace: 'all',
  setActiveSpace: (space) => set({ activeSpace: space, selectedLocationId: null, mapTap: null }),
  mapOverviewEpoch: 0,
  requestMapOverview: () =>
    set((state) => ({ mapOverviewEpoch: state.mapOverviewEpoch + 1 })),

  setLocations: (locations) => set({ locations }),

  setSelectedLocation: (id) =>
    set({ selectedLocationId: id, isMobilePanelOpen: true, mapTap: null }),

  toggleFeatureFilter: (feature) =>
    set((state) => ({
      featureFilters: state.featureFilters.includes(feature)
        ? state.featureFilters.filter((f) => f !== feature)
        : [...state.featureFilters, feature],
    })),

  toggleDisabilityFilter: (disability) =>
    set((state) => ({
      disabilityFilters: state.disabilityFilters.includes(disability)
        ? state.disabilityFilters.filter((d) => d !== disability)
        : [...state.disabilityFilters, disability],
    })),

  clearFilters: () => set({ featureFilters: [], disabilityFilters: [] }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setMobilePanelOpen: (open) => set({ isMobilePanelOpen: open }),

  setShowMobileFilters: (show) => set({ showMobileFilters: show }),

  openReportModal: (locationId) =>
    set({ reportModalLocationId: locationId, isPinModalOpen: false, mapTap: null }),

  closeReportModal: () => set({ reportModalLocationId: null }),

  setSubmittingReport: (submitting) => set({ isSubmittingReport: submitting }),

  addReport: (locationId, report) =>
    set((state) => ({
      locations: state.locations.map((loc) =>
        loc.id === locationId
          ? { ...loc, reports: [report, ...loc.reports], reportsLoaded: true }
          : loc,
      ),
    })),

  replaceReport: (locationId, report) =>
    set((state) => ({
      locations: state.locations.map((loc) =>
        loc.id === locationId
          ? {
              ...loc,
              reports: loc.reports.map((r) => (r.id === report.id ? report : r)),
              reportsLoaded: true,
            }
          : loc,
      ),
    })),

  upsertLocation: (location) =>
    set((state) => {
      const exists = state.locations.some((l) => l.id === location.id)
      return {
        locations: exists
          ? state.locations.map((l) => (l.id === location.id ? location : l))
          : [location, ...state.locations],
        selectedLocationId: location.id,
      }
    }),

  showToast: (message, type) =>
    set({ toast: { id: crypto.randomUUID(), message, type } }),

  clearToast: () => set({ toast: null }),

  setMapTap: (tap) => {
    if (!isWithinPhilippinesBounds(tap.lat, tap.lng)) {
      get().showToast('AccessMap PH only covers locations within the Philippines.', 'error')
      return
    }
    set({ mapTap: tap, isPinModalOpen: false, selectedLocationId: null })
  },

  clearMapTap: () => set({ mapTap: null, isPinModalOpen: false }),

  openPinModal: () =>
    set((state) => (state.mapTap ? { isPinModalOpen: true } : {})),

  closePinFlow: () =>
    set({ mapTap: null, isPinModalOpen: false, locationConfirmPrefill: null }),

  startReportFromSearch: (place) =>
    set({
      mapTap: { lat: place.lat, lng: place.lng },
      locationConfirmPrefill: {
        name: place.name,
        address: place.address,
        city: place.city,
        placeKey: place.placeKey,
      },
      isFindPlaceModalOpen: false,
      isPinModalOpen: true,
      selectedLocationId: null,
    }),
}))
