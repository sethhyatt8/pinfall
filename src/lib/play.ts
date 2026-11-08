import { haversineMeters } from './geo.ts'
import { estimateTarget } from './holes.ts'
import type { DriveMark, PositionPoint } from '../types.ts'

export function wholeFeet(meters: number): number {
  return Math.round(meters / 0.3048)
}

export function liveFeet(
  here: { lat: number; lng: number } | null,
  basket: { lat: number; lng: number } | null,
): number | null {
  if (!here || !basket) return null
  const meters = haversineMeters(here, basket)
  if (!Number.isFinite(meters)) return null
  return wholeFeet(meters)
}

export function driveFeet(
  points: readonly PositionPoint[],
  courseId: string,
  hole: number,
  teeVariant: string,
  basketVariant: string,
  drive: DriveMark | undefined,
): { driveFt: number | null; remainingFt: number | null } {
  if (!drive) return { driveFt: null, remainingFt: null }
  const tee = estimateTarget(points, { courseId, hole, target: 'tee', variant: teeVariant })
  const basket = estimateTarget(points, { courseId, hole, target: 'basket', variant: basketVariant })
  return {
    driveFt: tee ? liveFeet(drive, tee) : null,
    remainingFt: basket ? liveFeet(drive, basket) : null,
  }
}

export function ageLabel(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}
