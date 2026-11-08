import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { COURSES } from '../data/courses.ts'
import { loadBundledPoints, mergePinPoints } from '../lib/bundle.ts'
import { deleteMedia } from '../lib/media.ts'
import { ROUGH_GUESS_ACCURACY_M } from '../lib/sample.ts'
import { selectionKey, statKey } from '../lib/holes.ts'
import { createId, emptyPersisted } from '../lib/persist.ts'
import { loadState, peekState, saveState } from '../lib/storage.ts'
import type { AttachmentMeta, BasketId, DriveMark, GpsFix, Persisted, PositionPoint, StatOverride, TargetKind, TeeId, UnitSystem } from '../types.ts'
import { StoreContext, type StoreApi } from './store-context.ts'

export function StoreProvider({ children }: { children: ReactNode }) {
  // Paint from the synchronous copy. IndexedDB must not gate the first screen.
  const [data, setData] = useState<Persisted>(() => peekState())
  const [hydrated, setHydrated] = useState(false)
  const [bundled, setBundled] = useState<PositionPoint[]>([])
  const [pinsReady, setPinsReady] = useState(false)
  const edited = useRef(false)

  useEffect(() => {
    let cancel = false
    void loadState().then((loaded) => {
      if (cancel) return
      if (!edited.current) setData(loaded)
      setHydrated(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void saveState(data)
  }, [data, hydrated])

  useEffect(() => {
    let cancel = false
    const timer = window.setTimeout(() => {
      if (!cancel) setPinsReady(true)
    }, 2000)
    void loadBundledPoints(COURSES.map((course) => course.id)).then((points) => {
      if (cancel) return
      window.clearTimeout(timer)
      setBundled(points)
      setPinsReady(true)
    })
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [])

  const mergedPoints = useMemo(() => mergePinPoints(bundled, data.points), [bundled, data.points])

  const update = useCallback((recipe: (prev: Persisted) => Persisted) => {
    edited.current = true
    setData((prev) => recipe(prev))
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
    (point: Omit<PositionPoint, 'id' | 'createdAt' | 'source'>, fixes: GpsFix[] = []) => {
      update((prev) => {
        const id = createId()
        const createdAt = Date.now()
        return {
          ...prev,
          points: [...prev.points, { ...point, id, createdAt, source: 'gps' }],
          fixes: [
            ...prev.fixes,
            ...fixes.map((fix) => ({
              id: createId(),
              visitId: id,
              courseId: point.courseId,
              hole: point.hole,
              target: point.target,
              variant: point.variant,
              lat: fix.lat,
              lng: fix.lng,
              accuracyM: Number.isFinite(fix.accuracyM) && fix.accuracyM > 0 ? fix.accuracyM : 50,
              timestamp: fix.timestamp ?? createdAt,
            })),
          ],
        }
      })
    },
    [update],
  )

  const deletePoint = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        points: prev.points.filter((point) => point.id !== id),
        fixes: prev.fixes.filter((fix) => fix.visitId !== id),
      }))
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
        fixes: prev.fixes.filter(
          (fix) =>
            !(
              fix.courseId === courseId &&
              fix.hole === hole &&
              fix.target === target &&
              fix.variant === variant
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

  const setRoundHole = useCallback(
    (courseId: string, hole: number) => {
      update((prev) => {
        const rounds = prev.rounds.slice()
        const index = rounds.findIndex((round) => round.courseId === courseId && round.finishedAt == null)
        if (index < 0) {
          rounds.unshift({
            id: createId(),
            courseId,
            startedAt: Date.now(),
            strokes: {},
            hole,
            drives: {},
            attachments: [],
          })
          return { ...prev, rounds }
        }
        if (rounds[index].hole === hole) return prev
        rounds[index] = { ...rounds[index], hole }
        return { ...prev, rounds }
      })
    },
    [update],
  )

  const setDrive = useCallback(
    (courseId: string, hole: number, drive: DriveMark | null) => {
      update((prev) => {
        const rounds = prev.rounds.slice()
        const index = rounds.findIndex((round) => round.courseId === courseId && round.finishedAt == null)
        if (index < 0) {
          if (drive == null) return prev
          rounds.unshift({
            id: createId(),
            courseId,
            startedAt: Date.now(),
            strokes: {},
            hole,
            drives: { [String(hole)]: drive },
            attachments: [],
          })
          return { ...prev, rounds }
        }
        const round = rounds[index]
        const drives = { ...(round.drives ?? {}) }
        if (drive == null) delete drives[String(hole)]
        else drives[String(hole)] = drive
        rounds[index] = { ...round, drives }
        return { ...prev, rounds }
      })
    },
    [update],
  )

  const addAttachment = useCallback(
    (courseId: string, attachment: AttachmentMeta) => {
      update((prev) => {
        const rounds = prev.rounds.slice()
        const index = rounds.findIndex((round) => round.courseId === courseId && round.finishedAt == null)
        if (index < 0) {
          rounds.unshift({
            id: createId(),
            courseId,
            startedAt: Date.now(),
            strokes: {},
            hole: attachment.hole,
            drives: {},
            attachments: [attachment],
          })
          return { ...prev, rounds }
        }
        const round = rounds[index]
        rounds[index] = { ...round, attachments: [...(round.attachments ?? []), attachment] }
        return { ...prev, rounds }
      })
    },
    [update],
  )

  const removeAttachment = useCallback(
    (courseId: string, attachmentId: string) => {
      void deleteMedia(attachmentId)
      update((prev) => ({
        ...prev,
        rounds: prev.rounds.map((round) =>
          round.courseId === courseId && round.finishedAt == null
            ? { ...round, attachments: (round.attachments ?? []).filter((item) => item.id !== attachmentId) }
            : round,
        ),
      }))
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
      update((prev) => {
        const active = prev.rounds.find((round) => round.courseId === courseId && round.finishedAt == null)
        for (const attachment of active?.attachments ?? []) void deleteMedia(attachment.id)
        return {
          ...prev,
          rounds: prev.rounds.filter((round) => !(round.courseId === courseId && round.finishedAt == null)),
        }
      })
    },
    [update],
  )

  const replaceAll = useCallback((next: Persisted) => {
    edited.current = true
    setData(next)
  }, [])

  const eraseAll = useCallback(() => {
    edited.current = true
    setData(emptyPersisted())
  }, [])

  const api: StoreApi = {
    data,
    mergedPoints,
    pinsReady,
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
    setRoundHole,
    setDrive,
    addAttachment,
    removeAttachment,
    finishRound,
    discardActiveRound,
    replaceAll,
    eraseAll,
  }

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}
