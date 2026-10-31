import { estimatePosition } from './average.ts'
import type { GpsFix } from '../types.ts'

/** Fixes worse than this are dropped before a visit is averaged. */
export const MAX_ACCEPT_ACCURACY_M = 20

/** A visit is saved only when at least this many accepted fixes agree. */
export const MIN_GOOD_FIXES = 3

/** Stop early once the minimum window has enough agreeing fixes. */
export const SAMPLE_MIN_MS = 10_000

/** Hard stop for a learning tap. */
export const SAMPLE_MAX_MS = 15_000

/**
 * A pin dragged on the map is stored as one point with this accuracy,
 * so real GPS visits outweigh it.
 */
export const ROUGH_GUESS_ACCURACY_M = 50

export interface SampleSuccess {
  ok: true
  lat: number
  lng: number
  accuracyM: number
  usedCount: number
  poorCount: number
  outlierCount: number
}

export interface SampleFailure {
  ok: false
  reason: string
  goodCount: number
}

export function isAcceptedFix(fix: GpsFix, maxAccuracyM = MAX_ACCEPT_ACCURACY_M): boolean {
  return (
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.lng) &&
    fix.lat >= -90 &&
    fix.lat <= 90 &&
    fix.lng >= -180 &&
    fix.lng <= 180 &&
    Number.isFinite(fix.accuracyM) &&
    fix.accuracyM > 0 &&
    fix.accuracyM <= maxAccuracyM
  )
}

/** Average one learning visit down to a single stored point. */
export function finalizeSample(
  fixes: readonly GpsFix[],
  options?: { maxAccuracyM?: number; minFixes?: number },
): SampleSuccess | SampleFailure {
  const maxAccuracyM = options?.maxAccuracyM ?? MAX_ACCEPT_ACCURACY_M
  const minFixes = options?.minFixes ?? MIN_GOOD_FIXES
  const accepted = fixes.filter((fix) => isAcceptedFix(fix, maxAccuracyM))
  const poorCount = fixes.length - accepted.length
  const estimate = estimatePosition(accepted)
  const used = estimate?.usedCount ?? 0
  if (!estimate || used < minFixes) {
    const outliers = estimate?.rejectedCount ?? 0
    const outlierText =
      outliers > 0 ? ` and ${outliers} outlier${outliers === 1 ? '' : 's'}` : ''
    return {
      ok: false,
      goodCount: used,
      reason: `Need ${minFixes} fixes that agree. Kept ${used}. Ignored ${poorCount} weak reading${poorCount === 1 ? '' : 's'}${outlierText}.`,
    }
  }
  return {
    ok: true,
    lat: estimate.lat,
    lng: estimate.lng,
    accuracyM: estimate.errorRadiusM,
    usedCount: estimate.usedCount,
    poorCount,
    outlierCount: estimate.rejectedCount,
  }
}

export function shouldEndSample(elapsedMs: number, fixes: readonly GpsFix[]): boolean {
  if (elapsedMs >= SAMPLE_MAX_MS) return true
  if (elapsedMs >= SAMPLE_MIN_MS && finalizeSample(fixes).ok) return true
  return false
}
