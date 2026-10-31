import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { Missing, OfflineBanner, TopBar } from './Chrome.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse, getHole } from '../data/courses.ts'
import { estimateTarget, savedPinCount, shortHoleLabel } from '../lib/holes.ts'

export function CourseHome() {
  const { courseId = '' } = useParams()
  const course = getCourse(courseId)
  const { data } = useStore()
  useEffect(() => {
    if (course) document.title = `${course.shortName} · Pinfall`
  }, [course])

  if (!course) return <Missing message="That course isn’t on this phone." />

  const lastNumber = data.settings.lastHoleByCourse[course.id]
  const lastHole = lastNumber ? getHole(course, lastNumber) : undefined
  const start = lastHole ?? course.holes[0]

  return (
    <div className="page">
      <TopBar title={course.shortName} backTo="/" />
      <OfflineBanner />
      <main className="wrap stack">
        <div>
          <h2>{course.name}</h2>
          <p className="muted">{course.place}</p>
        </div>
        <p>{course.summary}</p>
        <p className="note">{course.centerNote}</p>
        <p className="muted">{savedPinCount(course, data.points)} saved pins on this phone</p>
        {start ? (
          <div className="link-row">
            <Link className="btn btn-primary" to={`/c/${course.id}/h/${start.number}`}>
              {lastHole ? `Resume ${lastHole.label}` : `Start ${start.label}`}
            </Link>
            <Link className="btn btn-secondary" to={`/c/${course.id}/card`}>
              Scorecard
            </Link>
          </div>
        ) : null}
        <Link className="btn btn-ghost btn-full" to={`/c/${course.id}/throw`}>
          Throw tool
        </Link>
        {course.layouts.map((layout) => (
          <section key={layout.name} className="stack">
            <h3>{layout.name}</h3>
            <div className="hole-grid">
              {layout.holeNumbers.map((number) => {
                const hole = getHole(course, number)
                if (!hole) return null
                const basketLearned = hole.baskets.some((basket) =>
                  estimateTarget(data.points, {
                    courseId: course.id,
                    hole: number,
                    target: 'basket',
                    variant: basket,
                  }),
                )
                const teeLearned = hole.tees.some((tee) =>
                  estimateTarget(data.points, {
                    courseId: course.id,
                    hole: number,
                    target: 'tee',
                    variant: tee.id,
                  }),
                )
                return (
                  <Link
                    key={number}
                    to={`/c/${course.id}/h/${number}`}
                    className={`hole-dot${basketLearned ? ' learned' : ''}`}
                    aria-label={hole.label}
                  >
                    {shortHoleLabel(hole.label)}
                    {teeLearned && !basketLearned ? <span className="tee-mark" /> : null}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
        <p className="muted">A lime hole has a basket pin. A blue dot means only the tee is saved.</p>
      </main>
    </div>
  )
}
