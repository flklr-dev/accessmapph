import { useMemo } from 'react'
import { useMapStore } from '../store/mapStore'
import { filterLocations, getLocationStatus } from '../store/selectors'
import type { Location } from '../types'

export function useFilteredLocations(): Location[] {
  const locations = useMapStore((s) => s.locations)
  const featureFilters = useMapStore((s) => s.featureFilters)
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)
  const searchQuery = useMapStore((s) => s.searchQuery)

  return useMemo(
    () => filterLocations(locations, featureFilters, disabilityFilters, searchQuery),
    [locations, featureFilters, disabilityFilters, searchQuery],
  )
}

export function useLocationStatus() {
  const featureFilters = useMapStore((s) => s.featureFilters)
  const disabilityFilters = useMapStore((s) => s.disabilityFilters)

  return useMemo(
    () => (location: Location) =>
      getLocationStatus(location, featureFilters, disabilityFilters),
    [featureFilters, disabilityFilters],
  )
}
