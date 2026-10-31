import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import type { Map as LeafletMap } from 'leaflet'
import { GpsPill, Missing, OfflineBanner, TopBar } from './Chrome.tsx'
import { MapCanvas, type MapPin } from './MapCanvas.tsx'
import { Button } from './ui.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse } from '../data/courses.ts'
import { useGeolocation, useNow } from '../hooks/useGeolocation.ts'
import { distanceUncertaintyMeters, formatAccuracy, formatDistance, haversineMeters, type LatLng } from '../lib/geo.ts'
import { NEAR_PIN_M } from '../lib/holes.ts'

interface Mark {
  lat: number
  lng: number
  accuracyM: number
  at: number
}

export function ThrowTool() {
  const { courseId = '' } = useParams()
  const course = getCourse(courseId)
  const { data } = useStore()
  const { fix, error } = useGeolocation(true)
  const now = useNow(true)
  const mapRef = useRef<LeafletMap | null>(null)
  const [start, setStart] = useState<Mark | null>(null)
  const [landing, setLanding] = useState<Mark | null>(null)
  const [nonce, setNonce] = useState(0)
  const [focusMe, setFocusMe] = useState(false)

  useEffect(() => {
    if (course) document.title = `Throw · ${course.shortName} · Pinfall`
  }, [course])

  if (!course) return <Missing message="That course isn’t on this phone." />

  const units = data.settings.units
  const distance = start && landing ? haversineMeters(start, landing) : null
  const uncertainty =
    start && landing && Number.isFinite(start.accuracyM) && Number.isFinite(landing.accuracyM)
      ? distanceUncertaintyMeters(start.accuracyM, landing.accuracyM)
      : null
  const ageSec = fix?.timestamp ? Math.max(0, Math.round((now - fix.timestamp) / 1000)) : null
  const pins: MapPin[] = []
  if (start) pins.push({ id: 'start', lat: start.lat, lng: start.lng, kind: 'throw', errorRadiusM: start.accuracyM })
  if (landing) pins.push({ id: 'landing', lat: landing.lat, lng: landing.lng, kind: 'throw', errorRadiusM: landing.accuracyM })
  const marks = pins.map((pin) => ({ lat: pin.lat, lng: pin.lng }))
  const fitPoints =
    focusMe && fix
      ? [fix, ...marks.filter((mark) => haversineMeters(fix, mark) <= NEAR_PIN_M)]
      : throwFit(fix, pins)
  const lines =
    start && landing
      ? [{ id: 'throw', color: '#d6f25c', positions: [start, landing] as LatLng[] }]
      : []

  function capture(): Mark | null {
    if (!fix) return null
    return {
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: Number.isFinite(fix.accuracyM) ? fix.accuracyM : 50,
      at: Date.now(),
    }
  }

  return (
    <div className="page">
      <TopBar title={`${course.shortName} throw`} backTo={`/c/${course.id}`} />
      <OfflineBanner />
      <main className="wrap stack">
        <p>Mark where the throw starts, then where it lands. This stays on the screen only — it is not saved as a pin.</p>
        <div className="hero-row">
          <div>
            <p className={`hero-distance ${distance == null ? 'hero-empty' : ''}`} data-testid="throw-distance">
              {distance == null ? '—' : formatDistance(distance, units)}
            </p>
            <p>{distance == null ? 'Distance shows after both marks' : `${units} between marks`}</p>
          </div>
          <GpsPill accuracyM={fix && Number.isFinite(fix.accuracyM) ? fix.accuracyM : null} ageSec={ageSec} error={error} />
        </div>
        {uncertainty != null ? <p className="muted">Roughly {formatAccuracy(uncertainty, units)} if the two fixes are independent.</p> : null}
        {start && start.accuracyM > 20 ? <p className="note">The start fix was weak ({formatAccuracy(start.accuracyM, units)}).</p> : null}
        {landing && landing.accuracyM > 20 ? (
          <p className="note">The landing fix was weak ({formatAccuracy(landing.accuracyM, units)}).</p>
        ) : null}
        <div className="link-row">
          <Button
            variant="secondary"
            full
            disabled={!fix}
            onClick={() => {
              const mark = capture()
              if (mark) {
                setFocusMe(false)
                setStart(mark)
                setNonce((value) => value + 1)
              }
            }}
          >
            Mark start
          </Button>
          <Button
            variant="primary"
            full
            disabled={!fix}
            onClick={() => {
              const mark = capture()
              if (mark) {
                setFocusMe(false)
                setLanding(mark)
                setNonce((value) => value + 1)
              }
            }}
          >
            Mark landing
          </Button>
        </div>
        <Button
          variant="ghost"
          full
          disabled={!start && !landing}
          onClick={() => {
            setStart(null)
            setLanding(null)
            setNonce((value) => value + 1)
          }}
        >
          Clear
        </Button>
        <div className="map-stage">
          <MapCanvas
            fallback={course.center}
            fitKey={`${start?.at ?? 0}:${landing?.at ?? 0}:${focusMe}:${nonce}`}
            fitPoints={fitPoints}
            user={fix}
            pins={pins}
            lines={lines}
            mapRef={mapRef}
          />
          <div className="map-tools">
            <button
              type="button"
              disabled={!fix}
              onClick={() => {
                setFocusMe(true)
                setNonce((value) => value + 1)
              }}
            >
              Where I am
            </button>
          </div>
          <div className="map-legend">
            <span>
              <i className="swatch you" /> You
            </span>
            <span>
              <i className="swatch throw" /> S / L
            </span>
          </div>
        </div>
        {!fix ? <p className="note">{error ?? 'Waiting for GPS before a mark can be saved.'}</p> : null}
      </main>
    </div>
  )
}

function throwFit(fix: LatLng | null, pins: MapPin[]): LatLng[] {
  const marks = pins.map((pin) => ({ lat: pin.lat, lng: pin.lng }))
  if (marks.length === 0) return fix ? [fix] : []
  if (!fix) return marks
  const near = marks.some((mark) => haversineMeters(fix, mark) <= NEAR_PIN_M)
  return near ? [...marks, fix] : marks
}
