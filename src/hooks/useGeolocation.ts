import { useEffect, useRef, useState } from 'react'
import type { GpsFix } from '../types.ts'

export function useGeolocation(enabled: boolean): { fix: GpsFix | null; error: string | null } {
  const [fix, setFix] = useState<GpsFix | null>(null)
  const [error, setError] = useState<string | null>(null)
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
          setError('Location is blocked. Allow location for this site, turn Precise Location on, then reload.')
          return
        }
        if (!gotFix.current) setError('Searching for GPS…')
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
    return () => {
      active = false
      navigator.geolocation.clearWatch(watch)
    }
  }, [enabled, unsupported])

  return { fix, error: unsupported ? 'This browser does not share GPS.' : error }
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
