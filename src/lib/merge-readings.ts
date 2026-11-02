import { estimatePosition } from './average.ts'
import type { ReadingRecord } from './readings.ts'
import type { TargetKind } from '../types.ts'

export interface BundledPin {
  hole: number
  target: TargetKind
  variant: string
  lat: number
  lng: number
  accuracyM: number
  usedCount: number
  rejectedCount: number
}

export interface BundledCourse {
  courseId: string
  readings: ReadingRecord[]
  pins: BundledPin[]
}

/** Union of bundled and exported readings, then one pin per tee or basket. */
export function mergeCourseReadings(existing: ReadingRecord[], incoming: ReadingRecord[]): BundledCourse | null {
  const courseIds = new Set<string>()
  for (const reading of [...existing, ...incoming]) courseIds.add(reading.courseId)
  if (courseIds.size !== 1) return null
  const courseId = [...courseIds][0]
  const byId = new Map<string, ReadingRecord>()
  for (const reading of existing) {
    if (reading.courseId === courseId) byId.set(reading.id, reading)
  }
  for (const reading of incoming) {
    if (reading.courseId !== courseId) continue
    if (!byId.has(reading.id)) byId.set(reading.id, reading)
  }
  const readings = [...byId.values()]
  return { courseId, readings, pins: pinsFromReadings(readings) }
}

export function pinsFromReadings(readings: readonly ReadingRecord[]): BundledPin[] {
  const groups = new Map<string, ReadingRecord[]>()
  for (const reading of readings) {
    const key = `${reading.hole}:${reading.target}:${reading.variant}`
    const group = groups.get(key)
    if (group) group.push(reading)
    else groups.set(key, [reading])
  }
  const pins: BundledPin[] = []
  for (const group of groups.values()) {
    const fixes = group.filter((reading) => reading.role === 'fix')
    const visits = group.filter((reading) => reading.role === 'visit')
    const visitIdsWithFixes = new Set(fixes.map((fix) => fix.visitId).filter((id): id is string => !!id))
    const legacyVisits = visits.filter((visit) => !visitIdsWithFixes.has(visit.id))
    const samples = fixes.length > 0 ? [...fixes, ...legacyVisits] : visits
    const estimate = estimatePosition(
      samples.map((reading) => ({ lat: reading.lat, lng: reading.lng, accuracyM: reading.accuracyM })),
    )
    if (!estimate) continue
    const sample = group[0]
    pins.push({
      hole: sample.hole,
      target: sample.target,
      variant: sample.variant,
      lat: estimate.lat,
      lng: estimate.lng,
      accuracyM: estimate.errorRadiusM,
      usedCount: estimate.usedCount,
      rejectedCount: estimate.rejectedCount,
    })
  }
  pins.sort((a, b) => a.hole - b.hole || a.target.localeCompare(b.target) || a.variant.localeCompare(b.variant))
  return pins
}

export function emptyBundle(courseId: string): BundledCourse {
  return { courseId, readings: [], pins: [] }
}
