import { useEffect, useRef, useState } from 'react'
import { finalizeSample, isAcceptedFix, shouldEndSample, type SampleSuccess } from '../lib/sample.ts'
import type { GpsFix } from '../types.ts'

export type SamplePhase =
  | { kind: 'idle' }
  | {
      kind: 'running'
      label: string
      startedAt: number
      now: number
      good: number
      poor: number
      bestAccuracyM: number | null
    }
  | { kind: 'saved'; label: string; result: SampleSuccess }
  | { kind: 'failed'; label: string; reason: string }

export function useSampler(onSaved: (result: SampleSuccess) => void): {
  phase: SamplePhase
  start: (label: string) => void
  cancel: () => void
  dismiss: () => void
} {
  const onSavedRef = useRef(onSaved)
  const [phase, setPhase] = useState<SamplePhase>({ kind: 'idle' })
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])
  const stopRef = useRef<(() => void) | null>(null)
  const finishedRef = useRef(false)

  const cleanup = () => {
    stopRef.current?.()
    stopRef.current = null
  }

  useEffect(() => cleanup, [])

  const cancel = () => {
    finishedRef.current = true
    cleanup()
    setPhase({ kind: 'idle' })
  }

  const dismiss = () => setPhase({ kind: 'idle' })

  const start = (label: string) => {
    cleanup()
    finishedRef.current = false
    if (!('geolocation' in navigator)) {
      setPhase({ kind: 'failed', label, reason: 'This browser does not share GPS with the page.' })
      return
    }
    const fixes: GpsFix[] = []
    const startedAt = Date.now()
    setPhase({ kind: 'running', label, startedAt, now: startedAt, good: 0, poor: 0, bestAccuracyM: null })

    const publish = () => {
      let good = 0
      let poor = 0
      let best: number | null = null
      for (const fix of fixes) {
        if (isAcceptedFix(fix)) {
          good += 1
          if (best == null || fix.accuracyM < best) best = fix.accuracyM
        } else {
          poor += 1
        }
      }
      setPhase((current) =>
        current.kind === 'running' ? { ...current, now: Date.now(), good, poor, bestAccuracyM: best } : current,
      )
    }

    const finish = () => {
      if (finishedRef.current) return
      finishedRef.current = true
      cleanup()
      const result = finalizeSample(fixes)
      if (result.ok) {
        onSavedRef.current(result)
        setPhase({ kind: 'saved', label, result })
      } else {
        setPhase({ kind: 'failed', label, reason: result.reason })
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy
        fixes.push({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: typeof accuracy === 'number' ? accuracy : Number.NaN,
          timestamp: position.timestamp,
        })
        publish()
        if (shouldEndSample(Date.now() - startedAt, fixes)) finish()
      },
      (error) => {
        if (error.code !== error.PERMISSION_DENIED || finishedRef.current) return
        finishedRef.current = true
        cleanup()
        setPhase({
          kind: 'failed',
          label,
          reason: 'Location is blocked. Allow location for this site, turn Precise Location on, and try again.',
        })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )

    const timerId = window.setInterval(() => {
      publish()
      if (shouldEndSample(Date.now() - startedAt, fixes)) finish()
    }, 200)

    stopRef.current = () => {
      navigator.geolocation.clearWatch(watchId)
      window.clearInterval(timerId)
    }
  }

  return { phase, start, cancel, dismiss }
}
