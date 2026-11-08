import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useStore } from '../context/store-context.ts'
import { getCourse } from '../data/courses.ts'
import { activeRound } from '../lib/scoring.ts'
import { serializeReadings } from '../lib/readings.ts'
import { shareOrDownload } from '../lib/share-file.ts'

export function CourseMode() {
  const { courseId = '' } = useParams()
  const course = getCourse(courseId)
  const { data, discardActiveRound } = useStore()
  const [note, setNote] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (course) document.title = `${course.shortName} · Pinfall`
  }, [course])

  if (!course) return <Navigate to="/" replace />

  const round = activeRound(data.rounds, course.id)
  const resumeHole = round?.hole ?? course.holes[0]?.number ?? 1
  const mapHole = data.settings.lastHoleByCourse[course.id] ?? course.holes[0]?.number ?? 1
  const finished = data.rounds
    .filter((item) => item.courseId === course.id && item.finishedAt != null)
    .slice()
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

  async function sendReadings() {
    const day = new Date().toISOString().slice(0, 10)
    const file = new File([serializeReadings(data)], `pinfall-readings-${day}.json`, { type: 'application/json' })
    const result = await shareOrDownload(file)
    if (result === 'downloaded') setNote('Share isn’t available. The readings file downloaded instead.')
    else if (result === 'shared') setNote(null)
  }

  return (
    <main className="page play-menu">
      <Link to="/" className="map-back">
        Courses
      </Link>
      <h1 className="play-course">{course.shortName}</h1>
      <Link className="play-choice" to={`/c/${course.id}/h/${mapHole}`}>
        Map a course
      </Link>
      <Link className="play-choice play-choice-main" data-testid="play-round" to={`/c/${course.id}/round/${resumeHole}`}>
        {round ? `Resume hole ${resumeHole}` : 'Play a round'}
      </Link>
      <button type="button" className="play-secondary" data-testid="send-readings" onClick={() => void sendReadings()}>
        Send readings
      </button>
      {note ? <p className="play-note">{note}</p> : null}
      {round && !confirmDiscard ? (
        <button type="button" className="play-text" onClick={() => setConfirmDiscard(true)}>
          Discard round
        </button>
      ) : null}
      {round && confirmDiscard ? (
        <div className="play-confirm">
          <p>Discard this round?</p>
          <button
            type="button"
            className="play-secondary"
            onClick={() => {
              discardActiveRound(course.id)
              setConfirmDiscard(false)
            }}
          >
            Discard
          </button>
          <button type="button" className="play-secondary" onClick={() => setConfirmDiscard(false)}>
            Keep
          </button>
        </div>
      ) : null}
      {finished.length > 0 ? (
        <section className="play-history">
          <h2>Rounds</h2>
          {finished.map((item) => {
            const strokes = Object.values(item.strokes).reduce((sum, value) => sum + value, 0)
            const when = new Date(item.finishedAt ?? item.startedAt).toLocaleDateString()
            return (
              <Link key={item.id} to={`/c/${course.id}/rounds/${item.id}`}>
                {when} · {strokes} strokes
              </Link>
            )
          })}
        </section>
      ) : null}
    </main>
  )
}
