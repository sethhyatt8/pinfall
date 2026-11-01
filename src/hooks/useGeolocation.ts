import { useEffect, useRef, useState } from 'react'
import type { LocationIssue } from '../lib/location.ts'
import type { GpsFix } from '../types.ts'

export function useGeolocation(enabled: boolean): {
  fix: GpsFix | null
  error: string | null
  issue: LocationIssue | null
} {
  const [fix, setFix] = useState<GpsFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issue, setIssue] = useState<LocationIssue | null>(null)
  const gotFix = useRef(false)
  const unsupported = enabled && !('geolocation' in navigator)

  useEffect(() => {
    if (!enabled || unsupported) return
    let active = true
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return
        gotFix.current = true
        setError(null)
        setIssue(null)
        const accuracy = position.coords.accuracy
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: typeof accuracy === 'number' ? accuracy : Number.NaN,
          timestamp: position.timestamp,
        })
      },
      (err) => {
        if (!active) return
        if (err.code === err.PERMISSION_DENIED) {
          setIssue('denied')
          setError('Location blocked')
          return
        }
        if (!gotFix.current && (err.code === err.POSITION_UNAVAILABLE || err.code === err.TIMEOUT)) {
          setIssue('unavailable')
          setError('Location unavailable')
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
    return () => {
      active = false
      navigator.geolocation.clearWatch(watch)
    }
  }, [enabled, unsupported])

  if (unsupported) return { fix: null, error: 'No GPS', issue: 'unsupported' }
  return { fix, error, issue }
}

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}
