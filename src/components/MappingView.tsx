import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { Missing } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse, getHole } from '../data/courses.ts'
import { useSampler } from '../hooks/useSampler.ts'
import { defaultTee, pointsFor, resolveBasket, resolveTee, selectionKey } from '../lib/holes.ts'
import { SAMPLE_MIN_MS, type SampleSuccess } from '../lib/sample.ts'
import type { TargetKind } from '../types.ts'

export function MappingView() {
  const { courseId = '', hole: holeParam = '' } = useParams()
  const course = getCourse(courseId)
  const hole = course ? getHole(course, Number(holeParam)) : undefined
  const { data, rememberHole, addGpsPoint } = useStore()
  const targetRef = useRef<{ target: TargetKind; variant: string } | null>(null)

  const sampler = useSampler((result: SampleSuccess, fixes) => {
    const target = targetRef.current
    if (!course || !hole || !target) return
    addGpsPoint(
      {
        courseId: course.id,
        hole: hole.number,
        target: target.target,
        variant: target.variant,
        lat: result.lat,
        lng: result.lng,
        accuracyM: result.accuracyM,
      },
      fixes,
    )
  })

  const tee = hole ? resolveTee(hole, data.settings.lastTee[selectionKey(course?.id ?? '', hole.number)]) : undefined
  const basketId = hole
    ? resolveBasket(hole, data.settings.lastBasket[selectionKey(course?.id ?? '', hole.number)])
    : 'A'

  useEffect(() => {
    if (course && hole && tee) rememberHole(course.id, hole.number, tee.id, basketId)
  }, [rememberHole, course, hole, tee, basketId])

  const phaseKind = sampler.phase.kind
  const dismiss = sampler.dismiss
  useEffect(() => {
    if (phaseKind !== 'saved') return
    const id = window.setTimeout(dismiss, 2000)
    return () => window.clearTimeout(id)
  }, [phaseKind, dismiss])

  useEffect(() => {
    if (course && hole) document.title = `Hole ${hole.number} · ${course.shortName} · Pinfall`
  }, [course, hole])

  if (!course || !hole || !tee) return <Missing message="That hole isn’t on this course." />

  const teePoints = pointsFor(data.points, {
    courseId: course.id,
    hole: hole.number,
    target: 'tee',
    variant: tee.id,
  }).filter((point) => point.source === 'gps')
  const basketPoints = pointsFor(data.points, {
    courseId: course.id,
    hole: hole.number,
    target: 'basket',
    variant: basketId,
  }).filter((point) => point.source === 'gps')
  const holeIndex = course.holes.findIndex((item) => item.number === hole.number)
  const prev = holeIndex > 0 ? course.holes[holeIndex - 1] : undefined
  const next = holeIndex >= 0 && holeIndex < course.holes.length - 1 ? course.holes[holeIndex + 1] : undefined
  const primaryTee = defaultTee(hole)
  const teeChoices = [primaryTee, ...hole.tees.filter((item) => item.id !== primaryTee.id)]
  const busy = sampler.phase.kind === 'running'

  function begin(target: TargetKind) {
    targetRef.current = { target, variant: target === 'basket' ? basketId : tee!.id }
    sampler.start(target === 'basket' ? 'Basket' : 'Tee')
  }

  return (
    <div className="page map-mode">
      <div className="map-top">
        <Link to={`/c/${course.id}`} className="map-back">
          Course
        </Link>
      </div>
      <div className="map-heading">
        <h1 className="map-hole">HOLE {hole.number}</h1>
        <p className="map-of">of {course.holes.length}</p>
      </div>
      {hole.tees.length > 1 ? (
        <div className="map-toggle" role="radiogroup" aria-label="Tee">
          {teeChoices.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === tee.id}
              onClick={() => rememberHole(course.id, hole.number, item.id, basketId)}
            >
              {index === 0 ? 'Main tee' : 'Alternate tee'}
            </button>
          ))}
        </div>
      ) : null}
      {hole.baskets.length > 1 ? (
        <div className="map-toggle" role="radiogroup" aria-label="Basket">
          {hole.baskets.map((id, index) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === basketId}
              onClick={() => rememberHole(course.id, hole.number, tee.id, id)}
            >
              {index === 0 ? 'Basket 1' : 'Basket 2'}
            </button>
          ))}
        </div>
      ) : null}
      <div className="map-slot">
        <button type="button" className="map-action tee" data-testid="mark-tee" disabled={busy} onClick={() => begin('tee')}>
          TEE
        </button>
        <SaveStatus count={teePoints.length} testId="tee-saved" />
      </div>
      <div className="map-slot">
        <button
          type="button"
          className="map-action basket"
          data-testid="mark-basket"
          disabled={busy}
          onClick={() => begin('basket')}
        >
          BASKET
        </button>
        <SaveStatus count={basketPoints.length} testId="basket-saved" />
      </div>
      <div className="map-nav">
        {prev ? (
          <Link className="map-step" to={`/c/${course.id}/h/${prev.number}`}>
            ◀ Hole {prev.number}
          </Link>
        ) : null}
        {next ? (
          <Link className="map-step" to={`/c/${course.id}/h/${next.number}`}>
            Hole {next.number} ▶
          </Link>
        ) : null}
      </div>
      {sampler.phase.kind !== 'idle' ? (
        <div className={`map-cover${sampler.phase.kind === 'saved' ? ' is-saved' : ''}`} role="status">
          {sampler.phase.kind === 'running' ? (
            <p>{holdStill(sampler.phase.now - sampler.phase.startedAt)}</p>
          ) : null}
          {sampler.phase.kind === 'saved' ? <p>SAVED ✓</p> : null}
          {sampler.phase.kind === 'failed' ? (
            <div className="map-fail">
              <p>{sampler.phase.reason}</p>
              <button type="button" className="map-step" onClick={sampler.dismiss}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SaveStatus({ count, testId }: { count: number; testId: string }) {
  if (count > 0) {
    return (
      <p className="map-status saved" data-testid={testId}>
        ✓ Saved ({count})
      </p>
    )
  }
  return (
    <p className="map-status wait" data-testid={testId}>
      Not yet
    </p>
  )
}

function holdStill(elapsedMs: number): string {
  const seconds = Math.max(0, Math.ceil((SAMPLE_MIN_MS - elapsedMs) / 1000))
  return seconds > 0 ? `Hold still… ${seconds}s` : 'Hold still…'
}
