import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Map as LeafletMap } from 'leaflet'
import { GpsPill, LocationHelp, Missing, OfflineBanner, TopBar } from './Chrome.tsx'
import { MapCanvas, type MapLine, type MapPin } from './MapCanvas.tsx'
import { Button, Dialog, Segmented, TextField } from './ui.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse, getHole } from '../data/courses.ts'
import { useGeolocation, useNow } from '../hooks/useGeolocation.ts'
import { useSampler } from '../hooks/useSampler.ts'
import { estimatePosition } from '../lib/average.ts'
import { feetToMeters, formatAccuracy, formatDistance, haversineMeters, type LatLng } from '../lib/geo.ts'
import {
  NEAR_PIN_M,
  estimateTarget,
  hasStatOverride,
  listedLengthFt,
  listedPar,
  pointsFor,
  readOverride,
  resolveBasket,
  resolveTee,
  selectionKey,
} from '../lib/holes.ts'
import {
  ROUGH_GUESS_ACCURACY_M,
  SAMPLE_MAX_MS,
  type SampleSuccess,
} from '../lib/sample.ts'
import type { TargetKind } from '../types.ts'

export function HoleView() {
  const { courseId = '', hole: holeParam = '' } = useParams()
  const course = getCourse(courseId)
  const hole = course ? getHole(course, Number(holeParam)) : undefined
  const { data, rememberHole, addGpsPoint, deletePoint, clearTarget, upsertGuess, setStatOverride, clearStatOverride } =
    useStore()
  const { fix, error, issue } = useGeolocation(true)
  const navigate = useNavigate()
  const now = useNow(true)
  const targetRef = useRef<{ target: TargetKind; variant: string } | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const [frameMode, setFrameMode] = useState<'pins' | 'me'>('pins')
  const [nonce, setNonce] = useState(0)
  const [dragNote, setDragNote] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [parDraft, setParDraft] = useState('')
  const [lengthDraft, setLengthDraft] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [pointsOpen, setPointsOpen] = useState(false)
  const [pointTab, setPointTab] = useState<TargetKind>('basket')
  const [clearing, setClearing] = useState<TargetKind | null>(null)

  const sampler = useSampler((result: SampleSuccess) => {
    const target = targetRef.current
    if (!course || !hole || !target) return
    addGpsPoint({
      courseId: course.id,
      hole: hole.number,
      target: target.target,
      variant: target.variant,
      lat: result.lat,
      lng: result.lng,
      accuracyM: result.accuracyM,
    })
  })

  const tee = hole ? resolveTee(hole, data.settings.lastTee[selectionKey(course?.id ?? '', hole.number)]) : undefined
  const basketId = hole ? resolveBasket(hole, data.settings.lastBasket[selectionKey(course?.id ?? '', hole.number)]) : 'A'
  const selection = `${courseId}:${hole?.number ?? ''}:${tee?.id ?? ''}:${basketId}`
  const [seenSelection, setSeenSelection] = useState(selection)
  if (seenSelection !== selection) {
    setSeenSelection(selection)
    setFrameMode('pins')
    setDragNote(null)
  }

  useEffect(() => {
    if (course && hole && tee) rememberHole(course.id, hole.number, tee.id, basketId)
  }, [rememberHole, course, hole, tee, basketId])

  useEffect(() => {
    if (course && hole) document.title = `${hole.label} · ${course.shortName} · Pinfall`
  }, [course, hole])

  if (!course || !hole || !tee) return <Missing message="That hole isn’t on this course." />

  const units = data.settings.units
  const override = readOverride(data.overrides, course.id, hole.number, tee.id, basketId)
  const par = listedPar(tee, basketId, override)
  const lengthFt = listedLengthFt(tee, basketId, override)
  const edited = hasStatOverride(override)
  const basketTarget = { courseId: course.id, hole: hole.number, target: 'basket' as const, variant: basketId }
  const teeTarget = { courseId: course.id, hole: hole.number, target: 'tee' as const, variant: tee.id }
  const basketPoints = pointsFor(data.points, basketTarget)
  const teePoints = pointsFor(data.points, teeTarget)
  const basketEstimate = estimateTarget(data.points, basketTarget)
  const teeEstimate = estimateTarget(data.points, teeTarget)
  const basketRough = basketPoints.length > 0 && basketPoints.every((point) => point.source === 'drag')
  const basketDistance = fix && basketEstimate ? haversineMeters(fix, basketEstimate) : null
  const teeDistance = fix && teeEstimate ? haversineMeters(fix, teeEstimate) : null
  const ageSec = fix?.timestamp ? Math.max(0, Math.round((now - fix.timestamp) / 1000)) : null
  const anchor = basketEstimate ?? teeEstimate ?? course.center
  const far = fix != null && haversineMeters(fix, anchor) > NEAR_PIN_M

  const pins: MapPin[] = []
  if (basketEstimate) {
    pins.push({
      id: 'basket',
      lat: basketEstimate.lat,
      lng: basketEstimate.lng,
      kind: 'basket',
      errorRadiusM: basketEstimate.errorRadiusM,
      draggable: true,
    })
  }
  if (teeEstimate) {
    pins.push({
      id: 'tee',
      lat: teeEstimate.lat,
      lng: teeEstimate.lng,
      kind: 'tee',
      errorRadiusM: teeEstimate.errorRadiusM,
      draggable: true,
    })
  }
  const basketDrag = basketPoints.find((point) => point.source === 'drag')
  if (basketDrag && basketEstimate && haversineMeters(basketDrag, basketEstimate) > 5) {
    pins.push({ id: 'basket-ghost', lat: basketDrag.lat, lng: basketDrag.lng, kind: 'basket', ghost: true })
  }
  const teeDrag = teePoints.find((point) => point.source === 'drag')
  if (teeDrag && teeEstimate && haversineMeters(teeDrag, teeEstimate) > 5) {
    pins.push({ id: 'tee-ghost', lat: teeDrag.lat, lng: teeDrag.lng, kind: 'tee', ghost: true })
  }

  const lines: MapLine[] = []
  if (fix && basketEstimate && haversineMeters(fix, basketEstimate) <= NEAR_PIN_M) {
    lines.push({ id: 'to-basket', color: '#ff6b3d', positions: [fix, basketEstimate] })
  }
  if (fix && teeEstimate && haversineMeters(fix, teeEstimate) <= NEAR_PIN_M) {
    lines.push({ id: 'to-tee', color: '#79d4ff', positions: [fix, teeEstimate] })
  }

  const solidPins = pins.filter((pin) => !pin.ghost)
  const fitPoints = fitPointsFor(
    frameMode,
    fix,
    solidPins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
  )
  const fitKey = `${course.id}:${hole.number}:${tee.id}:${basketId}:${frameMode}:${nonce}`
  const busy = sampler.phase.kind === 'running'
  const teeShort = tee.id === 'main' ? 'Tee' : `Tee ${tee.label}`
  const basketShort = hole.baskets.length > 1 ? `Basket ${basketId}` : 'Basket'
  const teeAction = `I’m at ${teeShort}`
  const basketAction = `I’m at ${basketShort}`
  const teeName = tee.id === 'main' ? 'the tee' : `tee ${tee.label}`
  const basketName = hole.baskets.length > 1 ? `basket ${basketId}` : 'the basket'
  const holeIndex = course.holes.findIndex((item) => item.number === hole.number)
  const prev = holeIndex > 0 ? course.holes[holeIndex - 1] : undefined
  const next = holeIndex >= 0 && holeIndex < course.holes.length - 1 ? course.holes[holeIndex + 1] : undefined

  let heroMeters: number | null = null
  let heroCaption = `Record ${basketName} to get a live distance`
  if (basketDistance != null) {
    heroMeters = basketDistance
    heroCaption = basketRough ? `rough pin · to ${basketName}` : `to ${basketName}`
  } else if (teeDistance != null) {
    heroMeters = teeDistance
    heroCaption = `to ${teeName} — basket not recorded`
  } else if (!fix) {
    heroCaption =
      issue === 'denied' || issue === 'unavailable' ? 'GPS is off. Follow the steps above.' : 'Waiting for GPS'
  } else {
    heroCaption = 'GPS is live. Record the basket, or drop a rough pin.'
  }

  function begin(target: TargetKind) {
    targetRef.current = { target, variant: target === 'basket' ? basketId : tee!.id }
    sampler.start(target === 'basket' ? (hole!.baskets.length > 1 ? `Basket ${basketId}` : 'Basket') : tee!.id === 'main' ? 'Tee' : `Tee ${tee!.label}`)
  }

  function onDragEnd(id: string, lat: number, lng: number) {
    if (id !== 'basket' && id !== 'tee') return
    const variant = id === 'basket' ? basketId : tee!.id
    upsertGuess(course!.id, hole!.number, id, variant, lat, lng)
    const others = pointsFor(data.points, {
      courseId: course!.id,
      hole: hole!.number,
      target: id,
      variant,
    }).filter((point) => point.source !== 'drag')
    const estimate = estimatePosition([
      ...others.map((point) => ({ lat: point.lat, lng: point.lng, accuracyM: point.accuracyM })),
      { lat, lng, accuracyM: ROUGH_GUESS_ACCURACY_M },
    ])
    if (estimate && haversineMeters(estimate, { lat, lng }) > 5) {
      setDragNote('Guess saved. GPS readings still hold the pin. Reset them if the basket moved.')
    } else {
      setDragNote('Rough guess saved. It counts very little once you record GPS on the spot.')
    }
  }

  function drop(target: TargetKind) {
    const center = mapRef.current?.getCenter()
    onDragEnd(target, center?.lat ?? course!.center.lat, center?.lng ?? course!.center.lng)
  }

  function saveEdit() {
    const parText = parDraft.trim()
    const lengthText = lengthDraft.trim()
    const nextPar = parText === '' ? null : Number(parText)
    const nextLength = lengthText === '' ? null : Number(lengthText)
    if (nextPar != null && (!Number.isInteger(nextPar) || nextPar < 1 || nextPar > 12)) {
      setEditError('Par should be a whole number from 1 to 12, or blank.')
      return
    }
    if (nextLength != null && !(nextLength >= 1 && nextLength <= 5000)) {
      setEditError('Length should be in feet, from 1 to 5000, or blank.')
      return
    }
    setStatOverride(course!.id, hole!.number, tee!.id, basketId, { par: nextPar, lengthFt: nextLength })
    setEditOpen(false)
  }

  const sheetPoints = (pointTab === 'basket' ? basketPoints : teePoints)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
  const sheetEstimate = pointTab === 'basket' ? basketEstimate : teeEstimate

  return (
    <div className="page hole-page">
      <TopBar title={course.shortName} backTo={`/c/${course.id}`} />
      <OfflineBanner />
      <div className="hole-layout">
        <div className="hole-copy stack">
          <div className="hole-title">
            <h2>{hole.label === String(hole.number) ? `Hole ${hole.number}` : hole.label}</h2>
            <p className="muted">
              {hole.number} of {course.holes.length}
              {par == null ? '' : ` · Par ${par}`}
            </p>
          </div>
          {issue ? <LocationHelp issue={issue} /> : null}
          <div className="hero-row">
            <p className={`hero-distance ${heroMeters == null ? 'hero-empty' : ''}`} data-testid="live-distance">
              {heroMeters == null ? '—' : formatDistance(heroMeters, units)}
            </p>
            <div className="stack">
              <p className="hero-unit">{units}</p>
              <GpsPill accuracyM={fix && Number.isFinite(fix.accuracyM) ? fix.accuracyM : null} ageSec={ageSec} error={error} />
            </div>
          </div>
          <p>{heroCaption}</p>
          {basketEstimate ? (
            <p className="muted">
              Basket {basketEstimate.usedCount} {basketEstimate.usedCount === 1 ? 'reading' : 'readings'}
              {basketEstimate.rejectedCount > 0 ? ` · ${basketEstimate.rejectedCount} left out` : ''}
              {' · '}
              {formatAccuracy(basketEstimate.errorRadiusM, units)}
              {basketRough ? ' · dragged guess' : ''}
            </p>
          ) : null}
          {basketDistance != null && teeDistance != null ? (
            <p className="muted">
              {formatDistance(teeDistance, units)} {units} to {teeName}
              {teeEstimate ? ` · ${formatAccuracy(teeEstimate.errorRadiusM, units)}` : ''}
            </p>
          ) : null}
          <p className="muted">
            {lengthFt == null ? 'Length not listed' : `Listed ${formatDistance(feetToMeters(lengthFt), units)} ${units}`}
            {edited ? ' · edited' : ''}{' '}
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setParDraft(par == null ? '' : String(par))
                setLengthDraft(lengthFt == null ? '' : String(lengthFt))
                setEditError(null)
                setEditOpen(true)
              }}
            >
              Edit par & length
            </button>
          </p>
          {far ? <p className="note">You’re a long way from this hole. The number is still the live distance.</p> : null}
          {dragNote ? <p className="note">{dragNote}</p> : null}
        </div>

        <div className="map-stage">
          <MapCanvas
            fallback={course.center}
            fitKey={fitKey}
            fitPoints={fitPoints}
            user={fix}
            pins={pins}
            lines={lines}
            mapRef={mapRef}
            onDragEnd={onDragEnd}
          />
          <div className="map-legend">
            <span>
              <i className="swatch you" /> You
            </span>
            <span>
              <i className="swatch tee" /> Tee
            </span>
            <span>
              <i className="swatch basket" /> Basket
            </span>
          </div>
        </div>
        <div className="map-actions">
          <button
            type="button"
            disabled={!fix}
            onClick={() => {
              setFrameMode('me')
              setNonce((value) => value + 1)
            }}
          >
            Where I am
          </button>
          {!basketEstimate ? (
            <button type="button" onClick={() => drop('basket')}>
              Basket at center
            </button>
          ) : null}
          {!teeEstimate ? (
            <button type="button" onClick={() => drop('tee')}>
              Tee at center
            </button>
          ) : null}
        </div>

        <div className="dock">
          <div className="hole-nav">
            <Link
              className={`btn btn-ghost hole-step ${prev ? '' : 'is-disabled'}`}
              to={prev ? `/c/${course.id}/h/${prev.number}` : '#'}
              aria-label="Previous hole"
              aria-disabled={!prev}
              onClick={(event) => {
                if (!prev) event.preventDefault()
              }}
            >
              Prev
            </Link>
            <label className="hole-jump">
              <span className="sr-only">Jump to hole</span>
              <select
                aria-label="Jump to hole"
                data-testid="hole-jump"
                value={hole.number}
                onChange={(event) => {
                  navigate(`/c/${course.id}/h/${event.target.value}`)
                }}
              >
                {course.holes.map((item) => (
                  <option key={item.number} value={item.number}>
                    {item.label === String(item.number) ? `Hole ${item.number}` : item.label}
                  </option>
                ))}
              </select>
            </label>
            <Link
              className={`btn btn-ghost hole-step ${next ? '' : 'is-disabled'}`}
              to={next ? `/c/${course.id}/h/${next.number}` : '#'}
              aria-label="Next hole"
              aria-disabled={!next}
              onClick={(event) => {
                if (!next) event.preventDefault()
              }}
            >
              Next
            </Link>
          </div>
          {hole.baskets.length > 1 ? (
            <Segmented
              label="Which basket"
              tone="basket"
              value={basketId}
              options={hole.baskets.map((basket) => ({ value: basket, label: `Basket ${basket}` }))}
              onChange={(value) => rememberHole(course.id, hole.number, tee.id, value)}
            />
          ) : null}
          {hole.tees.length > 1 ? (
            <Segmented
              label="Which tee"
              tone="tee"
              value={tee.id}
              options={hole.tees.map((item) => ({
                value: item.id,
                label: item.id === 'main' ? 'Tee' : `Tee ${item.label}`,
              }))}
              onChange={(value) => rememberHole(course.id, hole.number, value, basketId)}
            />
          ) : null}
          <p className="saved-count" data-testid="saved-count">
            <span className="tee-n" data-testid="tee-saved">
              {teeShort}: {teePoints.length} saved
            </span>
            <span className="basket-n" data-testid="basket-saved">
              {basketShort}: {basketPoints.length} saved
            </span>
          </p>
          <Button variant="tee" full disabled={busy} data-testid="mark-tee" onClick={() => begin('tee')}>
            {teeAction}
          </Button>
          <Button variant="basket" full disabled={busy} data-testid="mark-basket" onClick={() => begin('basket')}>
            {basketAction}
          </Button>
          <div className="link-row">
            <Link className="btn btn-ghost" to={`/c/${course.id}/throw`}>
              Throw
            </Link>
            <Link className="btn btn-ghost" to={`/c/${course.id}/card`}>
              Card
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => setPointsOpen(true)}>
              Readings
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={sampler.phase.kind !== 'idle'}
        title={sampler.phase.kind === 'idle' ? 'Recording' : sampler.phase.label}
        dismissable={sampler.phase.kind !== 'running'}
        onClose={() => {
          if (sampler.phase.kind === 'running') sampler.cancel()
          else sampler.dismiss()
        }}
      >
        {sampler.phase.kind === 'running' ? (
          <div className="stack">
            <div className="sample-row">
              <ProgressRing elapsedMs={sampler.phase.now - sampler.phase.startedAt} />
              <div>
                <p>Hold still in the open.</p>
                <p className="muted">
                  {sampler.phase.good} good · {sampler.phase.poor} weak
                  {sampler.phase.bestAccuracyM != null
                    ? ` · best ${formatAccuracy(sampler.phase.bestAccuracyM, units)}`
                    : ''}
                </p>
              </div>
            </div>
            <p className="muted">About 10–15 seconds. Weak fixes are thrown out, then one averaged point is saved.</p>
            <Button variant="ghost" full onClick={sampler.cancel}>
              Cancel
            </Button>
          </div>
        ) : null}
        {sampler.phase.kind === 'saved' ? (
          <div className="stack">
            <p>
              Saved this visit · {formatAccuracy(sampler.phase.result.accuracyM, units)} from{' '}
              {sampler.phase.result.usedCount} fixes.
            </p>
            {sampler.phase.result.poorCount > 0 ? (
              <p className="muted">{sampler.phase.result.poorCount} weak fixes were ignored.</p>
            ) : null}
            <Button variant="primary" full onClick={sampler.dismiss}>
              Done
            </Button>
          </div>
        ) : null}
        {sampler.phase.kind === 'failed' ? (
          <div className="stack">
            <p>{sampler.phase.reason}</p>
            <div className="dialog-actions">
              <Button variant="ghost" onClick={sampler.dismiss}>
                Close
              </Button>
              <Button variant="primary" onClick={() => sampler.start(sampler.phase.kind === 'failed' ? sampler.phase.label : '')}>
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={editOpen} title={`Hole ${hole.label}`} onClose={() => setEditOpen(false)}>
        <div className="stack">
          <p className="muted">
            Listed numbers for {basketName} from {teeName}. Length is always entered in feet.
          </p>
          <TextField
            label="Par"
            inputMode="numeric"
            value={parDraft}
            onChange={(event) => setParDraft(event.target.value)}
          />
          <TextField
            label="Length (feet)"
            inputMode="decimal"
            value={lengthDraft}
            onChange={(event) => setLengthDraft(event.target.value)}
          />
          {editError ? <p className="note">{editError}</p> : null}
          <div className="dialog-actions">
            {edited ? (
              <Button
                variant="ghost"
                onClick={() => {
                  clearStatOverride(course.id, hole.number, tee.id, basketId)
                  setEditOpen(false)
                }}
              >
                Reset
              </Button>
            ) : null}
            <Button variant="primary" onClick={saveEdit}>
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={pointsOpen} title="Readings" sheet onClose={() => { setPointsOpen(false); setClearing(null) }}>
        <div className="stack">
          <Segmented
            label="Which pin"
            value={pointTab}
            options={[
              { value: 'basket', label: hole.baskets.length > 1 ? `Basket ${basketId}` : 'Basket' },
              { value: 'tee', label: tee.id === 'main' ? 'Tee' : `Tee ${tee.label}` },
            ]}
            onChange={setPointTab}
          />
          {sheetEstimate ? (
            <p className="muted">
              Estimate uses {sheetEstimate.usedCount} of {sheetPoints.length}{' '}
              {sheetEstimate.rejectedCount > 0 ? `(${sheetEstimate.rejectedCount} left out as outliers) ` : ''}
              · {formatAccuracy(sheetEstimate.errorRadiusM, units)}
            </p>
          ) : (
            <p className="muted">No readings for this pin yet.</p>
          )}
          {sheetEstimate && sheetEstimate.rejectedCount > 0 ? (
            <p className="note">If a new visit keeps getting left out, the basket probably moved. Clear it and record again.</p>
          ) : null}
          <ul className="reading-list">
            {sheetPoints.map((point) => (
              <li key={point.id} className="reading">
                <div>
                  <p>{point.source === 'drag' ? 'Dragged guess' : 'GPS visit'}</p>
                  <p className="muted">
                    {formatAccuracy(point.accuracyM, units)} · {formatWhen(point.createdAt)}
                  </p>
                </div>
                <button type="button" className="btn btn-danger" onClick={() => deletePoint(point.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {clearing ? (
            <div className="stack">
              <p>
                {clearing === 'basket'
                  ? 'Clear every reading for this basket? Do this when the basket has moved, then record the new spot.'
                  : 'Clear every reading for this tee pad?'}
              </p>
              <div className="dialog-actions">
                <Button variant="ghost" onClick={() => setClearing(null)}>
                  Keep
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    clearTarget(course.id, hole.number, clearing, clearing === 'basket' ? basketId : tee.id)
                    setClearing(null)
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="danger"
              full
              disabled={sheetPoints.length === 0}
              onClick={() => setClearing(pointTab)}
            >
              {pointTab === 'basket' ? 'Basket moved — clear readings' : 'Clear tee readings'}
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  )
}

function fitPointsFor(mode: 'pins' | 'me', fix: LatLng | null, pins: LatLng[]): LatLng[] {
  if (mode === 'me' && fix) return [fix, ...pins.filter((pin) => haversineMeters(fix, pin) <= NEAR_PIN_M)]
  if (!fix) return pins
  return pins.some((pin) => haversineMeters(fix, pin) <= NEAR_PIN_M) ? [...pins, fix] : pins
}

function ProgressRing({ elapsedMs }: { elapsedMs: number }) {
  const radius = 28
  const circ = 2 * Math.PI * radius
  const fraction = Math.max(0, Math.min(1, elapsedMs / SAMPLE_MAX_MS))
  return (
    <svg className="ring" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={radius} stroke="#3a4b40" />
      <circle
        cx="36"
        cy="36"
        r={radius}
        stroke="#d6f25c"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - fraction)}
        strokeLinecap="round"
      />
    </svg>
  )
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
