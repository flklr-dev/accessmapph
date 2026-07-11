import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useMapStore } from '../../store/mapStore'
import { useFilteredLocations, useLocationStatus } from '../../hooks/useFilteredLocations'
import type { AccessibilityStatus, Location } from '../../types'
import { STATUS_LABELS } from '../../types'
import { PH_MAP_BOUNDS } from '../../lib/geo'
import { MapLegend } from './MapLegend'
import { MapTapBar } from './MapTapBar'
import { MapSearchBar } from './MapSearchBar'
import { MapPinHint } from './MapPinHint'
import { MapLeaderboardButton } from './MapLeaderboardButton'

const OVERVIEW_PADDING = L.point(24, 24)
const SPACE_FLY_DURATION = 0.65

function getOverviewBounds() {
  return L.latLngBounds(PH_MAP_BOUNDS)
}

/** Wait until Leaflet panes exist and the container has dimensions. */
function whenMapReady(map: L.Map, fn: () => void) {
  const run = () => {
    const container = map.getContainer()
    if (!container || container.clientWidth === 0) {
      requestAnimationFrame(run)
      return
    }
    if (!map.getPane('mapPane')) {
      map.whenReady(() => requestAnimationFrame(fn))
      return
    }
    fn()
  }
  map.whenReady(run)
}

function fitOverview(map: L.Map, animate: boolean) {
  whenMapReady(map, () => {
    const bounds = getOverviewBounds()
    try {
      if (animate) {
        map.flyToBounds(bounds, {
          padding: OVERVIEW_PADDING,
          duration: SPACE_FLY_DURATION,
          animate: true,
        })
      } else {
        map.fitBounds(bounds, { padding: OVERVIEW_PADDING, animate: false })
      }
    } catch {
      const zoom = map.getBoundsZoom(bounds, false, OVERVIEW_PADDING)
      map.setView(bounds.getCenter(), zoom, { animate: false })
    }
  })
}

function applyOverviewMinZoom(map: L.Map) {
  const minZoom = map.getBoundsZoom(getOverviewBounds(), false, OVERVIEW_PADDING)
  map.setMinZoom(minZoom)
  if (map.getZoom() < minZoom) {
    map.setZoom(minZoom)
  }
}

const statusMarkerClass: Record<AccessibilityStatus, string> = {
  accessible: 'access-marker-accessible',
  partial: 'access-marker-partial',
  inaccessible: 'access-marker-inaccessible',
  unverified: 'access-marker-unverified',
}

function createMarkerIcon(status: AccessibilityStatus, isSelected: boolean) {
  const selectedClass = isSelected ? 'access-marker-selected' : ''

  return L.divIcon({
    className: '',
    html: `<div class="access-marker ${statusMarkerClass[status]} ${selectedClass}" role="img" aria-hidden="true"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  })
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount()
  let sizeClass = 'access-cluster-sm'
  if (count >= 50) sizeClass = 'access-cluster-lg'
  else if (count >= 10) sizeClass = 'access-cluster-md'

  return L.divIcon({
    html: `<div class="access-cluster ${sizeClass}" aria-hidden="true"><span>${count}</span></div>`,
    className: 'access-cluster-wrapper',
    iconSize: L.point(40, 40),
  })
}

function buildPopupHtml(location: Location, status: AccessibilityStatus): string {
  return `<div style="font-family:var(--font-sans),system-ui,sans-serif;line-height:1.4">
    <strong style="font-size:14px;color:#2E2E35">${location.name}</strong><br/>
    <span style="font-size:13px;color:#5C5C66">${STATUS_LABELS[status]}</span><br/>
    <span style="font-size:12px;color:#9898A0">${location.city}</span>
  </div>`
}

function createDraftPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="draft-pin" role="img" aria-hidden="true"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

interface TrackedMarker {
  marker: L.Marker
  status: AccessibilityStatus
  location: Location
}

export function MapView() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersByIdRef = useRef<Map<string, TrackedMarker>>(new Map())
  const draftMarkerRef = useRef<L.Marker | null>(null)
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined)
  const overviewReadyRef = useRef(false)

  const filteredLocations = useFilteredLocations()
  const filteredLocationsRef = useRef(filteredLocations)
  const getLocationStatus = useLocationStatus()
  const selectedLocationId = useMapStore((s) => s.selectedLocationId)
  const selectedLocationIdRef = useRef(selectedLocationId)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const setMapTap = useMapStore((s) => s.setMapTap)
  const mapTap = useMapStore((s) => s.mapTap)
  const activeSpace = useMapStore((s) => s.activeSpace)
  const mapOverviewEpoch = useMapStore((s) => s.mapOverviewEpoch)

  useEffect(() => {
    filteredLocationsRef.current = filteredLocations
  }, [filteredLocations])

  useEffect(() => {
    selectedLocationIdRef.current = selectedLocationId
  }, [selectedLocationId])

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    const map = L.map(mapRef.current, {
      zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 55,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 25,
      iconCreateFunction: createClusterIcon,
    })
    map.addLayer(clusterGroup)
    clusterGroupRef.current = clusterGroup

    map.on('click', (e) => {
      setMapTap({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    map.on('resize', () => {
      applyOverviewMinZoom(map)
    })

    leafletMapRef.current = map
    whenMapReady(map, () => {
      map.invalidateSize()
      applyOverviewMinZoom(map)
      fitOverview(map, false)
    })

    return () => {
      clusterGroup.clearLayers()
      clusterGroupRef.current = null
      markersByIdRef.current.clear()
      map.remove()
      leafletMapRef.current = null
    }
  }, [setMapTap])

  // Incremental marker sync — avoid tearing down the whole layer on every change.
  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group) return

    const nextIds = new Set(filteredLocations.map((l) => l.id))
    const byId = markersByIdRef.current

    for (const [id, tracked] of byId) {
      if (!nextIds.has(id)) {
        group.removeLayer(tracked.marker)
        byId.delete(id)
      }
    }

    const toAdd: L.Marker[] = []

    for (const location of filteredLocations) {
      const status = getLocationStatus(location)
      const existing = byId.get(location.id)

      if (existing) {
        if (existing.status !== status) {
          existing.status = status
          existing.marker.setIcon(
            createMarkerIcon(status, location.id === selectedLocationIdRef.current),
          )
        }
        continue
      }

      const marker = L.marker([location.lat, location.lng], {
        icon: createMarkerIcon(status, location.id === selectedLocationIdRef.current),
        alt: `${location.name} — ${STATUS_LABELS[status]}`,
      })

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        if (!marker.getPopup()) {
          marker.bindPopup(buildPopupHtml(location, status), { className: 'accessmap-popup' })
        }
        setSelectedLocation(location.id)
      })

      byId.set(location.id, { marker, status, location })
      toAdd.push(marker)
    }

    if (toAdd.length > 0) {
      group.addLayers(toAdd)
    }
  }, [filteredLocations, getLocationStatus, setSelectedLocation])

  // Selection highlight only — no full marker rebuild.
  useEffect(() => {
    const prev = prevSelectedIdRef.current
    if (prev === selectedLocationId) return

    const byId = markersByIdRef.current

    if (prev) {
      const tracked = byId.get(prev)
      if (tracked) {
        tracked.marker.setIcon(createMarkerIcon(tracked.status, false))
      }
    }

    if (selectedLocationId) {
      const tracked = byId.get(selectedLocationId)
      if (tracked) {
        tracked.marker.setIcon(createMarkerIcon(tracked.status, true))
      }
    }
  }, [selectedLocationId])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    const prev = prevSelectedIdRef.current
    prevSelectedIdRef.current = selectedLocationId

    if (prev === undefined) return

    if (selectedLocationId) {
      const location = filteredLocationsRef.current.find((l) => l.id === selectedLocationId)
      if (location) {
        whenMapReady(map, () => {
          map.flyTo([location.lat, location.lng], 15, { duration: 0.8 })
        })
      }
      return
    }

    if (prev !== null) {
      fitOverview(map, true)
    }
  }, [selectedLocationId])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map || activeSpace !== 'all') return

    // Initial fit is handled in map setup; only animate on explicit overview requests.
    if (!overviewReadyRef.current) {
      overviewReadyRef.current = true
      if (mapOverviewEpoch === 0) return
    }

    fitOverview(map, true)
  }, [activeSpace, mapOverviewEpoch])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map || activeSpace === 'all') return

    const spaceCoords = {
      manila: { center: [14.56, 120.99] as [number, number], zoom: 12 },
      cebu: { center: [10.3187, 123.9064] as [number, number], zoom: 12 },
      davao: { center: [7.1183, 125.6478] as [number, number], zoom: 12 },
    }

    const { center, zoom } = spaceCoords[activeSpace]
    map.flyTo(center, zoom, { duration: SPACE_FLY_DURATION })
  }, [activeSpace])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    draftMarkerRef.current?.remove()
    draftMarkerRef.current = null

    if (mapTap) {
      const marker = L.marker([mapTap.lat, mapTap.lng], {
        icon: createDraftPinIcon(),
        interactive: false,
        zIndexOffset: 1000,
      })
      marker.addTo(map)
      draftMarkerRef.current = marker
    }
  }, [mapTap])

  return (
    <div className="absolute inset-0">
      <div
        ref={mapRef}
        className="w-full h-full"
        role="application"
        aria-label="Accessibility map of the Philippines. Tap the map to choose a spot."
      />

      {!mapTap && <MapSearchBar />}
      {!mapTap && <MapPinHint />}
      {!mapTap && <MapLeaderboardButton />}

      <MapTapBar />
      <MapLegend />
    </div>
  )
}
