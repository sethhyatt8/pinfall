import { useEffect } from 'react'
import { Link } from 'react-router'
import { InstallHint, OfflineBanner, TopBar } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { COURSES, getHole } from '../data/courses.ts'
import { basketSlotCount, savedPinCount } from '../lib/holes.ts'

export function CourseList() {
  const { data } = useStore()
  useEffect(() => {
    document.title = 'Pinfall'
  }, [])

  return (
    <div className="page">
      <TopBar
        title="Pinfall"
        extra={
          <Link to="/data" className="text-btn">
            Data
          </Link>
        }
      />
      <OfflineBanner />
      <main className="wrap stack">
        <p className="lede">
          Live distance to the basket. Pins start empty and are learned on this phone — nothing here is a guessed
          coordinate.
        </p>
        <InstallHint />
        {COURSES.map((course) => {
          const saved = savedPinCount(course, data.points)
          const last = data.settings.lastHoleByCourse[course.id]
          const lastHole = last ? getHole(course, last) : undefined
          return (
            <article key={course.id} className="course-card">
              <h2>{course.name}</h2>
              <p className="muted">{course.place}</p>
              <p>{course.summary}</p>
              <p className="muted">
                {course.holes.length} holes · {basketSlotCount(course)} basket spots · {saved} saved{' '}
                {saved === 1 ? 'pin' : 'pins'}
                {course.totalLengthFt ? ` · ~${course.totalLengthFt.toLocaleString()} ft` : ''}
              </p>
              <div className="link-row">
                <Link className="btn btn-primary" to={`/c/${course.id}`}>
                  Open
                </Link>
                {lastHole ? (
                  <Link className="btn btn-secondary" to={`/c/${course.id}/h/${lastHole.number}`}>
                    Resume {lastHole.label}
                  </Link>
                ) : null}
              </div>
            </article>
          )
        })}
      </main>
    </div>
  )
}
