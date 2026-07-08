import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../../store/mapStore'
import { useFilteredLocations, useLocationStatus } from '../../hooks/useFilteredLocations'
import type { AccessibilityStatus, Location } from '../../types'
import { STATUS_LABELS } from '../../types'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../../data/seedLocations'
import { MapLegend } from './MapLegend'
import { MapTapBar } from './MapTapBar'
import { MapSearchBar } from './MapSearchBar'
import { MapPinHint } from './MapPinHint'
import { MapLeaderboardButton } from './MapLeaderboardButton'

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

function createDraftPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="draft-pin" role="img" aria-hidden="true"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

export function MapView() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const draftMarkerRef = useRef<L.Marker | null>(null)
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined)

  const filteredLocations = useFilteredLocations()
  const getLocationStatus = useLocationStatus()
  const selectedLocationId = useMapStore((s) => s.selectedLocationId)
  const setSelectedLocation = useMapStore((s) => s.setSelectedLocation)
  const setMapTap = useMapStore((s) => s.setMapTap)
  const mapTap = useMapStore((s) => s.mapTap)
  const activeSpace = useMapStore((s) => s.activeSpace)

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    const map = L.map(mapRef.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e) => {
      setMapTap({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    leafletMapRef.current = map
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      map.remove()
      leafletMapRef.current = null
    }
  }, [setMapTap])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    filteredLocations.forEach((location: Location) => {
      const status = getLocationStatus(location)
      const isSelected = location.id === selectedLocationId

      const marker = L.marker([location.lat, location.lng], {
        icon: createMarkerIcon(status, isSelected),
        alt: `${location.name} — ${STATUS_LABELS[status]}`,
      })

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        setSelectedLocation(location.id)
      })

      marker.bindPopup(
        `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.4">
          <strong style="font-size:14px;color:#2E2E35">${location.name}</strong><br/>
          <span style="font-size:13px;color:#5C5C66">${STATUS_LABELS[status]}</span><br/>
          <span style="font-size:12px;color:#9898A0">${location.city}</span>
        </div>`,
        { className: 'accessmap-popup' },
      )

      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [filteredLocations, getLocationStatus, selectedLocationId, setSelectedLocation])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    const prev = prevSelectedIdRef.current
    prevSelectedIdRef.current = selectedLocationId

    // Initial mount — map already starts at the PH overview.
    if (prev === undefined) return

    if (selectedLocationId) {
      const location = filteredLocations.find((l) => l.id === selectedLocationId)
      if (location) {
        map.flyTo([location.lat, location.lng], 15, { duration: 0.8 })
      }
      return
    }

    // Pin deselected / detail panel closed → full Philippines overview.
    if (prev !== null) {
      map.flyTo([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM, { duration: 0.9 })
    }
  }, [selectedLocationId, filteredLocations])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return

    const spaceCoords = {
      all: { center: [12.5, 122.0] as [number, number], zoom: 6 },
      manila: { center: [14.56, 120.99] as [number, number], zoom: 12 },
      cebu: { center: [10.3187, 123.9064] as [number, number], zoom: 12 },
      davao: { center: [7.1183, 125.6478] as [number, number], zoom: 12 },
    }

    const { center, zoom } = spaceCoords[activeSpace]
    map.flyTo(center, zoom, { duration: 1.2 })
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
