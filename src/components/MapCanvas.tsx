import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LeafletEvent, Map as LeafletMap, TileEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../lib/geo.ts'
import { ESRI_ATTRIBUTION, ESRI_TILES } from '../lib/tiles.ts'

export interface MapPin {
  id: string
  lat: number
  lng: number
  kind: 'tee' | 'basket' | 'throw'
  errorRadiusM?: number
  draggable?: boolean
  ghost?: boolean
}

export interface MapLine {
  id: string
  color: string
  positions: LatLng[]
}

const PIN_COLOR = {
  tee: '#79d4ff',
  basket: '#ff6b3d',
  throw: '#d6f25c',
} as const

const ICONS = new Map<string, L.DivIcon>()

function pinLabel(pin: MapPin): string {
  if (pin.id === 'start') return 'S'
  if (pin.id === 'landing') return 'L'
  if (pin.kind === 'tee') return 'T'
  if (pin.kind === 'basket') return 'B'
  return '•'
}

function iconFor(pin: MapPin): L.DivIcon {
  const label = pinLabel(pin)
  const key = `${pin.kind}:${label}:${pin.ghost ? 'ghost' : 'solid'}`
  const cached = ICONS.get(key)
  if (cached) return cached
  const icon = L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin pin-${pin.kind}${pin.ghost ? ' pin-ghost' : ''}">${label}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
  ICONS.set(key, icon)
  return icon
}

export function MapCanvas({
  fallback,
  fitKey,
  fitPoints,
  user,
  pins,
  lines,
  mapRef,
  onDragEnd,
}: {
  fallback: LatLng
  fitKey: string
  fitPoints: LatLng[]
  user: { lat: number; lng: number; accuracyM: number } | null
  pins: MapPin[]
  lines: MapLine[]
  mapRef: RefObject<LeafletMap | null>
  onDragEnd?: (id: string, lat: number, lng: number) => void
}) {
  return (
    <MapContainer
      center={[fallback.lat, fallback.lng]}
      zoom={16}
      className="map-canvas"
      zoomControl
      attributionControl
    >
      <TileLayer url={ESRI_TILES} attribution={ESRI_ATTRIBUTION} maxZoom={19} maxNativeZoom={19} />
      <BindMap mapRef={mapRef} />
      <Frame fitKey={fitKey} fitPoints={fitPoints} fallback={fallback} />
      <InvalidateSize />
      <ReleaseHungTiles />
      {user && Number.isFinite(user.accuracyM) ? (
        <Circle
          center={[user.lat, user.lng]}
          radius={Math.max(user.accuracyM, 1)}
          pathOptions={{ color: '#5dffa8', weight: 1, fillColor: '#5dffa8', fillOpacity: 0.12 }}
        />
      ) : null}
      {user ? (
        <CircleMarker
          center={[user.lat, user.lng]}
          radius={7}
          pathOptions={{ color: '#101614', weight: 2, fillColor: '#5dffa8', fillOpacity: 1 }}
        />
      ) : null}
      {pins.map((pin) => (
        <PinLayer key={pin.id} pin={pin} onDragEnd={onDragEnd} />
      ))}
      {lines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.positions.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{ color: line.color, weight: 3, opacity: 0.9, dashArray: '7 8' }}
        />
      ))}
    </MapContainer>
  )
}

function PinLayer({ pin, onDragEnd }: { pin: MapPin; onDragEnd?: (id: string, lat: number, lng: number) => void }) {
  const onDragEndRef = useRef(onDragEnd)
  useEffect(() => {
    onDragEndRef.current = onDragEnd
  }, [onDragEnd])
  const position = useMemo<[number, number]>(() => [pin.lat, pin.lng], [pin.lat, pin.lng])
  const handlers = useMemo(() => {
    if (!pin.draggable) return undefined
    return {
      dragend(event: LeafletEvent) {
        const marker = event.target as L.Marker
        const latlng = marker.getLatLng()
        onDragEndRef.current?.(pin.id, latlng.lat, latlng.lng)
      },
    }
  }, [pin.draggable, pin.id])

  const color = PIN_COLOR[pin.kind]
  return (
    <>
      {!pin.ghost && pin.errorRadiusM != null && pin.errorRadiusM > 0 ? (
        <Circle
          center={position}
          radius={pin.errorRadiusM}
          pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.16 }}
        />
      ) : null}
      <Marker
        position={position}
        draggable={Boolean(pin.draggable)}
        icon={iconFor(pin)}
        zIndexOffset={pin.ghost ? 50 : pin.kind === 'basket' ? 300 : 200}
        eventHandlers={handlers}
      />
    </>
  )
}

function BindMap({ mapRef }: { mapRef: RefObject<LeafletMap | null> }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])
  return null
}

function Frame({ fitKey, fitPoints, fallback }: { fitKey: string; fitPoints: LatLng[]; fallback: LatLng }) {
  const map = useMap()
  const pointsRef = useRef(fitPoints)
  const fallbackRef = useRef(fallback)
  useEffect(() => {
    pointsRef.current = fitPoints
    fallbackRef.current = fallback
  })
  useEffect(() => {
    map.invalidateSize()
    const points = pointsRef.current
    const home = fallbackRef.current
    if (points.length === 0) {
      map.setView([home.lat, home.lng], 16, { animate: false })
      return
    }
    const first = points[0]
    if (points.length === 1 && first) {
      map.setView([first.lat, first.lng], 18, { animate: false })
      return
    }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.45), { animate: false, maxZoom: 18 })
  }, [fitKey, map])
  return null
}

const TILE_LIMIT_MS = 8000

function ReleaseHungTiles() {
  const map = useMap()
  useEffect(() => {
    const timers = new Map<HTMLImageElement, number>()
    const drop = (tile: HTMLImageElement) => {
      const timer = timers.get(tile)
      if (timer != null) window.clearTimeout(timer)
      timers.delete(tile)
    }
    const arm = (tile: HTMLImageElement) => {
      if (timers.has(tile) || tile.complete) return
      const timer = window.setTimeout(() => {
        timers.delete(tile)
        if (!tile.complete) {
          // Abort the image request so a stuck satellite tile cannot hold the document load open.
          tile.src =
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        }
      }, TILE_LIMIT_MS)
      timers.set(tile, timer)
    }
    const onStart = (event: TileEvent) => {
      const tile = event.tile
      if (!(tile instanceof HTMLImageElement)) return
      drop(tile)
      arm(tile)
    }
    const onDone = (event: TileEvent) => {
      if (event.tile instanceof HTMLImageElement) drop(event.tile)
    }
    // The tile layer requests images in an effect that runs before this one.
    map.getContainer().querySelectorAll('img.leaflet-tile').forEach((node) => {
      if (node instanceof HTMLImageElement) arm(node)
    })
    map.on('tileloadstart', onStart)
    map.on('tileload', onDone)
    map.on('tileerror', onDone)
    return () => {
      map.off('tileloadstart', onStart)
      map.off('tileload', onDone)
      map.off('tileerror', onDone)
      for (const timer of timers.values()) window.clearTimeout(timer)
    }
  }, [map])
  return null
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}
