import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Missing, OfflineBanner, TopBar } from './Chrome.tsx'
import { Button, Dialog } from './ui.tsx'
import { useStore } from '../context/store-context.ts'
import { getCourse, getHole } from '../data/courses.ts'
import { listedPar, readOverride, resolveBasket, resolveTee, selectionKey } from '../lib/holes.ts'
import { activeRound, formatRelative, roundTotals } from '../lib/scoring.ts'
import type { Persisted, Round } from '../types.ts'

export function Scorecard() {
  const { courseId = '' } = useParams()
  const course = getCourse(courseId)
  const { data, setStrokes, finishRound, discardActiveRound } = useStore()
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (course) document.title = `Card · ${course.shortName} · Pinfall`
  }, [course])

  if (!course) return <Missing message="That course isn’t on this phone." />

  const round = activeRound(data.rounds, course.id)
  const totals = round ? roundTotals(course, round, data.settings, data.overrides) : null
  const comparedStrokes = round ? strokesOnHolesWithPar(course, round, data) : 0
  const past = data.rounds
    .filter((item) => item.courseId === course.id && item.finishedAt != null)
    .slice()
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

  return (
    <div className="page">
      <TopBar title={`${course.shortName} card`} backTo={`/c/${course.id}`} />
      <OfflineBanner />
      <main className="wrap stack">
        <div className="hero-row">
          <div>
            <p className="hero-distance score-total">{totals ? totals.strokes : '—'}</p>
            <p className="muted">{round ? 'strokes this round' : 'No round yet. Tap + on a hole.'}</p>
          </div>
          {totals && totals.parHoles > 0 ? (
            <p className="score-rel">{formatRelative(comparedStrokes, totals.parStrokes)}</p>
          ) : null}
        </div>
        {totals && totals.parHoles > 0 ? (
          <p className="muted">
            {formatRelative(comparedStrokes, totals.parStrokes)} on {totals.parHoles}{' '}
            {totals.parHoles === 1 ? 'hole' : 'holes'} with a par
          </p>
        ) : (
          <p className="muted">Holes without a par are left out of the plus/minus.</p>
        )}

        {course.layouts.map((layout) => (
          <section key={layout.name}>
            <h2>{layout.name}</h2>
            {layout.holeNumbers.map((number) => {
              const hole = getHole(course, number)
              if (!hole) return null
              const strokes = round?.strokes[String(number)]
              const tee = resolveTee(hole, data.settings.lastTee[selectionKey(course.id, number)])
              const basket = resolveBasket(hole, data.settings.lastBasket[selectionKey(course.id, number)])
              const par = listedPar(tee, basket, readOverride(data.overrides, course.id, number, tee.id, basket))
              return (
                <div key={number} className="score-row">
                  <Link to={`/c/${course.id}/h/${number}`}>
                    <strong>{hole.label}</strong>
                    <span className="muted">{par == null ? ' Par —' : ` Par ${par}`}</span>
                  </Link>
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label={`Remove a stroke on ${hole.label}`}
                      disabled={!strokes}
                      onClick={() => setStrokes(course.id, number, strokes == null || strokes <= 1 ? null : strokes - 1)}
                    >
                      −
                    </button>
                    <strong>{strokes ?? '–'}</strong>
                    <button
                      type="button"
                      aria-label={`Add a stroke on ${hole.label}`}
                      onClick={() => setStrokes(course.id, number, (strokes ?? 0) + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        ))}

        <div className="link-row">
          <Button variant="ghost" full disabled={!round} onClick={() => setConfirm('discard')}>
            Discard
          </Button>
          <Button variant="primary" full disabled={!totals || totals.scoredHoles === 0} onClick={() => setConfirm('finish')}>
            Finish round
          </Button>
        </div>

        {past.length > 0 ? (
          <section className="stack">
            <h2>Past rounds</h2>
            {past.map((item) => {
              const pastTotals = roundTotals(course, item, data.settings, data.overrides)
              const open = openId === item.id
              return (
                <div key={item.id} className="note stack">
                  <button type="button" className="text-btn history-toggle" onClick={() => setOpenId(open ? null : item.id)}>
                    {formatWhen(item.finishedAt ?? item.startedAt)} · {pastTotals.strokes} strokes
                    {pastTotals.parHoles > 0
                      ? ` · ${formatRelative(strokesOnHolesWithPar(course, item, data), pastTotals.parStrokes)}`
                      : ''}
                  </button>
                  {open ? (
                    <p className="muted">
                      {course.holes
                        .map((hole) => {
                          const strokes = item.strokes[String(hole.number)]
                          return strokes ? `${hole.label} ${strokes}` : null
                        })
                        .filter(Boolean)
                        .join(' · ') || 'No strokes saved.'}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </section>
        ) : null}
      </main>

      <Dialog open={confirm != null} title={confirm === 'finish' ? 'Finish this round?' : 'Discard this round?'} onClose={() => setConfirm(null)}>
        <div className="stack">
          <p>
            {confirm === 'finish'
              ? 'It moves to past rounds on this phone. You can start another by tapping +.'
              : 'Strokes from the current round are deleted. Saved pins stay.'}
          </p>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === 'finish' ? 'primary' : 'danger'}
              onClick={() => {
                if (confirm === 'finish') finishRound(course.id)
                else discardActiveRound(course.id)
                setConfirm(null)
              }}
            >
              {confirm === 'finish' ? 'Finish' : 'Discard'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function strokesOnHolesWithPar(course: NonNullable<ReturnType<typeof getCourse>>, round: Round, data: Persisted): number {
  let strokes = 0
  for (const hole of course.holes) {
    const score = round.strokes[String(hole.number)]
    if (!score) continue
    const tee = resolveTee(hole, data.settings.lastTee[selectionKey(course.id, hole.number)])
    const basket = resolveBasket(hole, data.settings.lastBasket[selectionKey(course.id, hole.number)])
    const par = listedPar(tee, basket, readOverride(data.overrides, course.id, hole.number, tee.id, basket))
    if (par == null) continue
    strokes += score
  }
  return strokes
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
