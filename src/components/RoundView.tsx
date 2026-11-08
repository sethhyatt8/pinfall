import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Missing } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse, getHole } from '../data/courses.ts'
import { useGeolocation } from '../hooks/useGeolocation.ts'
import { formatAccuracy } from '../lib/geo.ts'
import { defaultTee, estimateTarget, resolveBasket, resolveTee, selectionKey } from '../lib/holes.ts'
import { locationHelpText } from '../lib/location.ts'
import { mediaErrorText, saveMedia } from '../lib/media.ts'
import { createId } from '../lib/persist.ts'
import { ageLabel, driveFeet, liveFeet } from '../lib/play.ts'
import { activeRound } from '../lib/scoring.ts'

export function RoundView() {
  const { courseId = '', hole: holeParam = '' } = useParams()
  const course = getCourse(courseId)
  const hole = course ? getHole(course, Number(holeParam)) : undefined
  const { data, mergedPoints, pinsReady, rememberHole, setStrokes, setRoundHole, setDrive, addAttachment, removeAttachment, finishRound } =
    useStore()
  const geo = useGeolocation(true)
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const tee = hole ? resolveTee(hole, data.settings.lastTee[selectionKey(course?.id ?? '', hole.number)]) : undefined
  const basketId = hole ? resolveBasket(hole, data.settings.lastBasket[selectionKey(course?.id ?? '', hole.number)]) : 'A'

  useEffect(() => {
    if (course && hole && tee) rememberHole(course.id, hole.number, tee.id, basketId)
  }, [rememberHole, course, hole, tee, basketId])

  useEffect(() => {
    if (course && hole) setRoundHole(course.id, hole.number)
  }, [course, hole, setRoundHole])

  useEffect(() => {
    if (course && hole) document.title = `Hole ${hole.number} · ${course.shortName} · Pinfall`
  }, [course, hole])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!course || !hole || !tee) return <Missing message="That hole isn’t on this course." />

  const round = activeRound(data.rounds, course.id)
  const strokes = round?.strokes[String(hole.number)]
  const drive = round?.drives?.[String(hole.number)]
  const photos = (round?.attachments ?? []).filter((item) => item.hole === hole.number)
  const basket = pinsReady
    ? estimateTarget(mergedPoints, { courseId: course.id, hole: hole.number, target: 'basket', variant: basketId })
    : null
  const feet = pinsReady && geo.fix && basket ? liveFeet(geo.fix, basket) : null
  const driveResult = driveFeet(mergedPoints, course.id, hole.number, tee.id, basketId, drive)
  const holeIndex = course.holes.findIndex((item) => item.number === hole.number)
  const next = holeIndex >= 0 && holeIndex < course.holes.length - 1 ? course.holes[holeIndex + 1] : undefined
  const primaryTee = defaultTee(hole)
  const teeChoices = [primaryTee, ...hole.tees.filter((item) => item.id !== primaryTee.id)]
  const basketLabel = hole.baskets.length > 1 ? `Basket ${hole.baskets.indexOf(basketId) + 1}` : 'basket'

  const status: string[] = []
  if (!pinsReady) status.push('Checking saved pins…')
  else if (!basket) status.push('No saved basket')
  if (geo.issue === 'denied' || geo.issue === 'unavailable') status.push('No location')
  else if (geo.issue === 'unsupported') status.push('No GPS')
  else if (!geo.fix) status.push('Waiting for GPS')
  else if (feet != null) {
    const accuracy = geo.fix.accuracyM > 0 ? `${formatAccuracy(geo.fix.accuracyM, 'ft')} · ` : ''
    status.push(`${accuracy}${ageLabel(geo.fix.timestamp ?? now, now)}`)
  }

  async function markDrive() {
    setMarking(true)
    setMarkError(null)
    try {
      const reading = geo.fix ?? (await readOnce())
      if (!Number.isFinite(reading.lat) || !Number.isFinite(reading.lng)) {
        setMarkError('No location. Stand in the open and mark again.')
        return
      }
      const accuracy = Number.isFinite(reading.accuracyM) && reading.accuracyM >= 0 ? reading.accuracyM : 0
      setDrive(course!.id, hole!.number, {
        lat: reading.lat,
        lng: reading.lng,
        accuracyM: accuracy,
        timestamp: reading.timestamp || Date.now(),
      })
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 0
      setMarkError(code === 1 ? locationHelpText('denied') : 'No location. Stand in the open and mark again.')
    } finally {
      setMarking(false)
    }
  }

  async function addFile(file: File | undefined) {
    if (!file || !course || !hole) return
    setMediaError(null)
    const id = createId()
    const saved = await saveMedia(id, file)
    if (!saved.ok) {
      setMediaError(mediaErrorText(saved.reason))
      return
    }
    addAttachment(course.id, {
      id,
      hole: hole.number,
      name: file.name || 'photo',
      mime: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: Date.now(),
    })
  }

  function finishHole() {
    if (!strokes || !round) return
    if (next) {
      setRoundHole(course!.id, next.number)
      navigate(`/c/${course!.id}/round/${next.number}`)
      return
    }
    finishRound(course!.id)
    navigate(`/c/${course!.id}/rounds/${round.id}`)
  }

  return (
    <main className="page play-mode">
      <Link to={`/c/${course.id}`} className="map-back">
        Course
      </Link>
      <h1 className="play-hole">HOLE {hole.number}</h1>
      <p className="play-of">of {course.holes.length}</p>
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
      <p className="play-distance" data-testid="live-distance">
        {feet == null ? '—' : feet}
      </p>
      <p className="play-unit">{feet == null ? status.join(' · ') : `ft to ${basketLabel}`}</p>
      {feet != null ? <p className="play-fresh">{status.join(' · ')}</p> : null}
      {geo.issue === 'denied' || geo.issue === 'unavailable' ? (
        <p className="play-help">{locationHelpText(geo.issue)}</p>
      ) : null}
      <button type="button" className="play-go" data-testid="mark-drive" disabled={marking} onClick={() => void markDrive()}>
        {marking ? 'Reading GPS…' : drive ? 'Mark again' : 'Mark drive landing'}
      </button>
      {drive ? (
        <p className="play-drive" data-testid="drive-result">
          {driveResult.driveFt == null ? 'No saved tee' : `Drive ${driveResult.driveFt} ft`}
          {driveResult.remainingFt == null ? '' : ` · ${driveResult.remainingFt} ft left`}
        </p>
      ) : null}
      {markError ? <p className="play-help">{markError}</p> : null}
      <div className="play-score">
        <button type="button" aria-label="Fewer strokes" onClick={() => setStrokes(course.id, hole.number, strokes == null || strokes <= 1 ? null : strokes - 1)}>
          −
        </button>
        <p data-testid="strokes">{strokes ?? '—'}</p>
        <button type="button" aria-label="More strokes" onClick={() => setStrokes(course.id, hole.number, (strokes ?? 0) + 1)}>
          +
        </button>
      </div>
      <p className="play-score-label">strokes</p>
      <button type="button" className="play-finish" data-testid="finish-hole" disabled={!strokes} onClick={finishHole}>
        Finish hole
      </button>
      <label className="play-photo">
        Add photo or video
        <input
          type="file"
          accept="image/*,video/*"
          data-testid="add-photo"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void addFile(file)
          }}
        />
      </label>
      {photos.map((photo) => (
        <p key={photo.id} className="play-file" data-testid="attachment">
          <span>{photo.name}</span>
          <button type="button" onClick={() => removeAttachment(course.id, photo.id)}>
            Remove
          </button>
        </p>
      ))}
      {mediaError ? <p className="play-help">{mediaError}</p> : null}
    </main>
  )
}

function readOnce(): Promise<{ lat: number; lng: number; accuracyM: number; timestamp: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'))
      return
    }
    const timer = window.setTimeout(() => reject(new Error('timeout')), 8000)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer)
        const accuracy = position.coords.accuracy
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 0,
          timestamp: position.timestamp || Date.now(),
        })
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 },
    )
  })
}
