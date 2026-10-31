import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Splash } from '../components/Chrome.tsx'
import { ROUGH_GUESS_ACCURACY_M } from '../lib/sample.ts'
import { selectionKey, statKey } from '../lib/holes.ts'
import { createId, emptyPersisted } from '../lib/persist.ts'
import { loadState, saveState } from '../lib/storage.ts'
import type { BasketId, Persisted, PositionPoint, StatOverride, TargetKind, TeeId, UnitSystem } from '../types.ts'
import { StoreContext, type StoreApi } from './store-context.ts'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted | null>(null)

  useEffect(() => {
    let cancel = false
    void loadState().then((loaded) => {
      if (!cancel) setData(loaded)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!data) return
    void saveState(data)
  }, [data])

  const update = useCallback((recipe: (prev: Persisted) => Persisted) => {
    setData((prev) => (prev ? recipe(prev) : prev))
  }, [])

  const setUnits = useCallback(
    (units: UnitSystem) => {
      update((prev) =>
        prev.settings.units === units ? prev : { ...prev, settings: { ...prev.settings, units } },
      )
    },
    [update],
  )

  const dismissInstallHint = useCallback(() => {
    update((prev) =>
      prev.settings.installHintDismissed
        ? prev
        : { ...prev, settings: { ...prev.settings, installHintDismissed: true } },
    )
  }, [update])

  const rememberHole = useCallback(
    (courseId: string, hole: number, tee: TeeId, basket: BasketId) => {
      update((prev) => {
        const key = selectionKey(courseId, hole)
        if (
          prev.settings.lastCourseId === courseId &&
          prev.settings.lastHoleByCourse[courseId] === hole &&
          prev.settings.lastTee[key] === tee &&
          prev.settings.lastBasket[key] === basket
        ) {
          return prev
        }
        return {
          ...prev,
          settings: {
            ...prev.settings,
            lastCourseId: courseId,
            lastHoleByCourse: { ...prev.settings.lastHoleByCourse, [courseId]: hole },
            lastTee: { ...prev.settings.lastTee, [key]: tee },
            lastBasket: { ...prev.settings.lastBasket, [key]: basket },
          },
        }
      })
    },
    [update],
  )

  const addGpsPoint = useCallback(
    (point: Omit<PositionPoint, 'id' | 'createdAt' | 'source'>) => {
      update((prev) => ({
        ...prev,
        points: [...prev.points, { ...point, id: createId(), createdAt: Date.now(), source: 'gps' }],
      }))
    },
    [update],
  )

  const deletePoint = useCallback(
    (id: string) => {
      update((prev) => ({ ...prev, points: prev.points.filter((point) => point.id !== id) }))
    },
    [update],
  )

  const clearTarget = useCallback(
    (courseId: string, hole: number, target: TargetKind, variant: string) => {
      update((prev) => ({
        ...prev,
        points: prev.points.filter(
          (point) =>
            !(
              point.courseId === courseId &&
              point.hole === hole &&
              point.target === target &&
              point.variant === variant
            ),
        ),
      }))
    },
    [update],
  )

  const upsertGuess = useCallback(
    (courseId: string, hole: number, target: TargetKind, variant: string, lat: number, lng: number) => {
      update((prev) => {
        const kept = prev.points.filter(
          (point) =>
            !(
              point.courseId === courseId &&
              point.hole === hole &&
              point.target === target &&
              point.variant === variant &&
              point.source === 'drag'
            ),
        )
        const guess: PositionPoint = {
          id: createId(),
          courseId,
          hole,
          target,
          variant,
          lat,
          lng,
          accuracyM: ROUGH_GUESS_ACCURACY_M,
          source: 'drag',
          createdAt: Date.now(),
        }
        return { ...prev, points: [...kept, guess] }
      })
    },
    [update],
  )

  const setStatOverride = useCallback(
    (courseId: string, hole: number, tee: TeeId, basket: BasketId, stat: StatOverride) => {
      update((prev) => {
        const courseOverrides = { ...(prev.overrides[courseId] ?? {}) }
        courseOverrides[statKey(hole, tee, basket)] = stat
        return { ...prev, overrides: { ...prev.overrides, [courseId]: courseOverrides } }
      })
    },
    [update],
  )

  const clearStatOverride = useCallback(
    (courseId: string, hole: number, tee: TeeId, basket: BasketId) => {
      update((prev) => {
        const courseOverrides = { ...(prev.overrides[courseId] ?? {}) }
        delete courseOverrides[statKey(hole, tee, basket)]
        return { ...prev, overrides: { ...prev.overrides, [courseId]: courseOverrides } }
      })
    },
    [update],
  )

  const setStrokes = useCallback(
    (courseId: string, hole: number, strokes: number | null) => {
      update((prev) => {
        const rounds = prev.rounds.slice()
        const index = rounds.findIndex((round) => round.courseId === courseId && round.finishedAt == null)
        if (strokes == null) {
          if (index < 0) return prev
          const round = rounds[index]
          const nextStrokes = { ...round.strokes }
          delete nextStrokes[String(hole)]
          rounds[index] = { ...round, strokes: nextStrokes }
          return { ...prev, rounds }
        }
        const safe = Math.max(1, Math.min(25, Math.round(strokes)))
        if (index < 0) {
          rounds.unshift({
            id: createId(),
            courseId,
            startedAt: Date.now(),
            strokes: { [String(hole)]: safe },
          })
          return { ...prev, rounds }
        }
        const round = rounds[index]
        rounds[index] = { ...round, strokes: { ...round.strokes, [String(hole)]: safe } }
        return { ...prev, rounds }
      })
    },
    [update],
  )

  const finishRound = useCallback(
    (courseId: string) => {
      update((prev) => {
        const index = prev.rounds.findIndex((round) => round.courseId === courseId && round.finishedAt == null)
        if (index < 0) return prev
        const rounds = prev.rounds.slice()
        rounds[index] = { ...rounds[index], finishedAt: Date.now() }
        return { ...prev, rounds }
      })
    },
    [update],
  )

  const discardActiveRound = useCallback(
    (courseId: string) => {
      update((prev) => ({
        ...prev,
        rounds: prev.rounds.filter((round) => !(round.courseId === courseId && round.finishedAt == null)),
      }))
    },
    [update],
  )

  const replaceAll = useCallback((next: Persisted) => {
    setData(next)
  }, [])

  const eraseAll = useCallback(() => {
    setData(emptyPersisted())
  }, [])

  if (!data) return <Splash />

  const api: StoreApi = {
    data,
    setUnits,
    dismissInstallHint,
    rememberHole,
    addGpsPoint,
    deletePoint,
    clearTarget,
    upsertGuess,
    setStatOverride,
    clearStatOverride,
    setStrokes,
    finishRound,
    discardActiveRound,
    replaceAll,
    eraseAll,
  }

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
