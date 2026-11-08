import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { OfflineBanner, TopBar } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { COURSES, getHole } from '../data/courses.ts'
import { serializeReadings } from '../lib/readings.ts'
import { shareOrDownload } from '../lib/share-file.ts'

export function CourseList() {
  const { data } = useStore()
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Pinfall'
  }, [])

  async function sendReadings() {
    const day = new Date().toISOString().slice(0, 10)
    const file = new File([serializeReadings(data)], `pinfall-readings-${day}.json`, { type: 'application/json' })
    const result = await shareOrDownload(file)
    if (result === 'downloaded') setNote('Share isn’t available. The readings file downloaded instead.')
    else if (result === 'shared') setNote(null)
  }

  return (
    <div className="page">
      <TopBar title="Pinfall" />
      <OfflineBanner />
      <main className="wrap stack">
        <button type="button" className="btn btn-primary btn-full" data-testid="send-readings" onClick={() => void sendReadings()}>
          Send readings
        </button>
        <p className="muted">Pick a course.</p>
        {note ? <p className="note">{note}</p> : null}
        {COURSES.map((course) => {
          const last = data.settings.lastHoleByCourse[course.id]
          const hole = (last ? getHole(course, last) : undefined) ?? course.holes[0]
          if (!hole) return null
          return (
            <Link key={course.id} className="course-pick" to={`/c/${course.id}`}>
              <span>{course.shortName}</span>
              <small>{course.place}</small>
            </Link>
          )
        })}
      </main>
    </div>
  )
}
