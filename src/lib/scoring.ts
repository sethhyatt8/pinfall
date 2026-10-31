import { listedPar, readOverride, resolveBasket, resolveTee } from './holes.ts'
import type { CourseSeed, OverrideMap, Round, Settings } from '../types.ts'

export function activeRound(rounds: readonly Round[], courseId: string): Round | undefined {
  return rounds.find((round) => round.courseId === courseId && round.finishedAt == null)
}

export function formatRelative(strokes: number, par: number): string {
  const delta = strokes - par
  if (delta === 0) return 'E'
  return delta > 0 ? `+${delta}` : String(delta)
}

export interface RoundTotals {
  strokes: number
  scoredHoles: number
  parStrokes: number
  parHoles: number
}

export function roundTotals(
  course: CourseSeed,
  round: Round,
  settings: Settings,
  overrides: OverrideMap,
): RoundTotals {
  let strokes = 0
  let scoredHoles = 0
  let parStrokes = 0
  let parHoles = 0
  for (const hole of course.holes) {
    const score = round.strokes[String(hole.number)]
    if (!score) continue
    strokes += score
    scoredHoles += 1
    const tee = resolveTee(hole, settings.lastTee[`${course.id}:${hole.number}`])
    const basket = resolveBasket(hole, settings.lastBasket[`${course.id}:${hole.number}`])
    const par = listedPar(tee, basket, readOverride(overrides, course.id, hole.number, tee.id, basket))
    if (par == null) continue
    parStrokes += par
    parHoles += 1
  }
  return { strokes, scoredHoles, parStrokes, parHoles }
}
