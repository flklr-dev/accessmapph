import type { Location, MapSpace } from '../types'

const cache = new Map<MapSpace, Location[]>()
const inflight = new Map<MapSpace, Promise<Location[]>>()

export function getCachedLocations(space: MapSpace): Location[] | undefined {
  return cache.get(space)
}

export function setCachedLocations(space: MapSpace, locations: Location[]): void {
  cache.set(space, locations)
}

/** One fetch per space; concurrent callers share the same promise. */
export async function loadLocationsForSpace(
  space: MapSpace,
  fetcher: () => Promise<Location[]>,
): Promise<Location[]> {
  const cached = cache.get(space)
  if (cached) return cached

  const pending = inflight.get(space)
  if (pending) return pending

  const promise = fetcher()
    .then((locations) => {
      cache.set(space, locations)
      inflight.delete(space)
      return locations
    })
    .catch((error) => {
      inflight.delete(space)
      throw error
    })

  inflight.set(space, promise)
  return promise
}

/** Warm all city scopes in the background so space switches feel instant. */
export function prefetchAllSpaces(
  fetcher: (space: MapSpace) => Promise<Location[]>,
): void {
  const spaces: MapSpace[] = ['all', 'manila', 'cebu', 'davao']
  for (const space of spaces) {
    if (!cache.has(space) && !inflight.has(space)) {
      void loadLocationsForSpace(space, () => fetcher(space))
    }
  }
}
