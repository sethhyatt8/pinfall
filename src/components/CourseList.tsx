import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { OfflineBanner, TopBar } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { COURSES, getHole } from '../data/courses.ts'
import { serializeReadings } from '../lib/readings.ts'

export function CourseList() {
  const { data } = useStore()
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Pinfall'
  }, [])

  async function sendReadings() {
    const day = new Date().toISOString().slice(0, 10)
    const file = new File([serializeReadings(data)], `pinfall-readings-${day}.json`, { type: 'application/json' })
    const share = { files: [file], title: 'Pinfall readings' }
    try {
      if (typeof navigator.canShare === 'function' && navigator.canShare(share)) {
        await navigator.share(share)
        setNote(null)
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
    setNote('Share isn’t available. The readings file downloaded instead.')
  }

  return (
    <div className="page">
      <TopBar title="Pinfall" />
      <OfflineBanner />
      <main className="wrap stack">
        <button type="button" className="btn btn-primary btn-full" data-testid="send-readings" onClick={() => void sendReadings()}>
          Send readings
        </button>
        <p className="muted">Pick a course. Stand on the tee, then the basket, and hold still.</p>
        {note ? <p className="note">{note}</p> : null}
        {COURSES.map((course) => {
          const last = data.settings.lastHoleByCourse[course.id]
          const hole = (last ? getHole(course, last) : undefined) ?? course.holes[0]
          if (!hole) return null
          return (
            <Link key={course.id} className="course-pick" to={`/c/${course.id}/h/${hole.number}`}>
              <span>{course.shortName}</span>
              <small>{course.place}</small>
            </Link>
          )
        })}
      </main>
    </div>
  )
}
