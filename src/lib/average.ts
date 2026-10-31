import { haversineMeters, toEnu, fromEnu, type LatLng } from './geo.ts'

/**
 * Phone GPS sometimes reports a tiny accuracy that would dominate the
 * average forever. Anything tighter than this is treated as 1 m.
 */
export const MIN_ACCURACY_M = 1

/**
 * A stored point is an outlier when it is farther than this from the
 * weighted mean AND farther than OUTLIER_SIGMAS times its own accuracy.
 * The floor keeps ordinary disc-golf jitter from rejecting a tight cluster.
 */
export const OUTLIER_FLOOR_M = 8

export const OUTLIER_SIGMAS = 3

export interface WeightedPoint {
  lat: number
  lng: number
  /** 1-sigma uncertainty in meters. Larger means less influence. */
  accuracyM: number
}

export interface Estimate {
  lat: number
  lng: number
  /** 1-sigma radius of the estimated position, in meters. */
  errorRadiusM: number
  usedCount: number
  rejectedCount: number
}

/**
 * Inverse-variance weighted mean of nearby GPS points, with outlier rejection.
 *
 * Weights are 1 / accuracy², computed in a local east/north frame so we are
 * not averaging latitude and longitude as if they were linear everywhere.
 *
 * The reported radius is the larger of:
 * - the formal standard error, 1 / sqrt(sum of weights)
 * - the weighted RMS residual divided by sqrt(n), so disagreeing points
 *   widen the circle even when each one claims to be precise
 */
export function estimatePosition(points: readonly WeightedPoint[]): Estimate | null {
  const usable: WeightedPoint[] = []
  for (const point of points) {
    if (!isUsable(point)) continue
    usable.push({
      lat: point.lat,
      lng: point.lng,
      accuracyM: Math.max(point.accuracyM, MIN_ACCURACY_M),
    })
  }
  if (usable.length === 0) return null
  if (usable.length === 1) {
    const only = usable[0]
    return {
      lat: only.lat,
      lng: only.lng,
      errorRadiusM: only.accuracyM,
      usedCount: 1,
      rejectedCount: 0,
    }
  }

  let current = usable
  let rejectedCount = 0
  while (current.length >= 2) {
    const mean = weightedMean(current)
    let worstIndex = 0
    let worstDistance = -1
    for (let index = 0; index < current.length; index += 1) {
      const distance = haversineMeters(mean, current[index])
      if (distance > worstDistance) {
        worstDistance = distance
        worstIndex = index
      }
    }
    const worst = current[worstIndex]
    const threshold = Math.max(OUTLIER_FLOOR_M, OUTLIER_SIGMAS * worst.accuracyM)
    if (worstDistance <= threshold) break
    current = current.filter((_, index) => index !== worstIndex)
    rejectedCount += 1
  }

  const mean = weightedMean(current)
  return {
    lat: mean.lat,
    lng: mean.lng,
    errorRadiusM: errorRadius(current, mean),
    usedCount: current.length,
    rejectedCount,
  }
}

function isUsable(point: WeightedPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Number.isFinite(point.accuracyM) &&
    point.accuracyM > 0 &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  )
}

function weightOf(point: WeightedPoint): number {
  return 1 / (point.accuracyM * point.accuracyM)
}

function weightedMean(points: readonly WeightedPoint[]): LatLng {
  let origin = points[0]
  for (const point of points) {
    if (point.accuracyM < origin.accuracyM) origin = point
  }
  let east = 0
  let north = 0
  let total = 0
  for (const point of points) {
    const weight = weightOf(point)
    const local = toEnu(origin, point)
    east += weight * local.eastM
    north += weight * local.northM
    total += weight
  }
  return fromEnu(origin, east / total, north / total)
}

function errorRadius(points: readonly WeightedPoint[], mean: LatLng): number {
  let totalWeight = 0
  let residual = 0
  for (const point of points) {
    const weight = weightOf(point)
    const distance = haversineMeters(mean, point)
    totalWeight += weight
    residual += weight * distance * distance
  }
  const formal = 1 / Math.sqrt(totalWeight)
  const rms = Math.sqrt(residual / totalWeight)
  const scatter = rms / Math.sqrt(points.length)
  return Math.max(formal, scatter)
}
