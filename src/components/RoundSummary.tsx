import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Missing } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse } from '../data/courses.ts'
import { resolveBasket, resolveTee, selectionKey } from '../lib/holes.ts'
import { loadMedia } from '../lib/media.ts'
import { driveFeet } from '../lib/play.ts'
import { shareOrDownload } from '../lib/share-file.ts'
import { zipStore } from '../lib/zip.ts'

export function RoundSummary() {
  const { courseId = '', roundId = '' } = useParams()
  const course = getCourse(courseId)
  const { data, mergedPoints } = useStore()
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const round = course ? data.rounds.find((item) => item.id === roundId && item.courseId === course.id) : undefined

  if (!course || !round) return <Missing message="That round isn’t on this phone." />

  const total = Object.values(round.strokes).reduce((sum, value) => sum + value, 0)

  async function saveRound() {
    if (!course || !round) return
    setSaving(true)
    setNote(null)
    const holes = course.holes.map((hole) => {
      const tee = resolveTee(hole, data.settings.lastTee[selectionKey(course.id, hole.number)])
      const basket = resolveBasket(hole, data.settings.lastBasket[selectionKey(course.id, hole.number)])
      const drive = round.drives?.[String(hole.number)]
      const distances = driveFeet(mergedPoints, course.id, hole.number, tee?.id ?? 'main', basket, drive)
      return {
        hole: hole.number,
        strokes: round.strokes[String(hole.number)] ?? null,
        drive: drive
          ? {
              lat: drive.lat,
              lng: drive.lng,
              accuracyM: drive.accuracyM,
              timestamp: drive.timestamp,
              driveFt: distances.driveFt,
              remainingFt: distances.remainingFt,
            }
          : null,
      }
    })
    const files: { name: string; data: Uint8Array }[] = []
    const attachments = []
    let missing = 0
    for (const item of round.attachments ?? []) {
      const blob = await loadMedia(item.id)
      const fileName = `files/hole-${item.hole}-${safeName(item.name)}`
      if (!blob) {
        missing += 1
        continue
      }
      files.push({ name: fileName, data: new Uint8Array(await blob.arrayBuffer()) })
      attachments.push({ file: fileName, hole: item.hole, name: item.name, mime: item.mime, size: item.size })
    }
    const body = {
      app: 'pinfall',
      kind: 'round',
      version: 1,
      courseId: course.id,
      startedAt: round.startedAt,
      finishedAt: round.finishedAt ?? null,
      holes,
      attachments,
    }
    files.unshift({ name: 'round.json', data: new TextEncoder().encode(JSON.stringify(body, null, 2)) })
    const day = new Date(round.finishedAt ?? round.startedAt).toISOString().slice(0, 10)
    const file = new File([new Uint8Array(zipStore(files))], `pinfall-round-${day}.zip`, { type: 'application/zip' })
    const result = await shareOrDownload(file)
    if (missing > 0) {
      setNote(`${missing} photo could not be included. The scores are in the file.`)
    } else if (result === 'downloaded') {
      setNote('The round file downloaded. Open the share sheet on your phone, choose Google Drive, and save it in the folder Pinfall Readings. Pinfall does not upload it.')
    } else if (result === 'shared') {
      setNote('Choose Google Drive in the share sheet and save it in the folder Pinfall Readings. Pinfall does not upload it.')
    }
    setSaving(false)
  }

  return (
    <main className="page play-menu">
      <Link to={`/c/${course.id}`} className="map-back">
        Course
      </Link>
      <h1 className="play-hole">Round done</h1>
      <p className="play-distance" data-testid="round-total">
        {total}
      </p>
      <p className="play-unit">strokes</p>
      <ul className="play-holes">
        {course.holes.map((hole) => (
          <li key={hole.number}>
            Hole {hole.number}
            <strong>{round.strokes[String(hole.number)] ?? '—'}</strong>
          </li>
        ))}
      </ul>
      <button type="button" className="play-finish" data-testid="save-round" disabled={saving} onClick={() => void saveRound()}>
        {saving ? 'Saving…' : 'Save round file'}
      </button>
      <p className="play-help">
        Save the file from the share sheet into Google Drive, folder Pinfall Readings. Pinfall does not upload it.
      </p>
      {note ? <p className="play-note">{note}</p> : null}
    </main>
  )
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return (cleaned || 'file').slice(0, 80)
}
