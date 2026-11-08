import type { PositionPoint } from '../types.ts'
import { sanitizeReading } from './readings.ts'

/** Published visits become pins. Raw fix logs are ignored. */
export function pointsFromBundle(raw: unknown): PositionPoint[] {
  if (!isRecord(raw) || !Array.isArray(raw.readings)) return []
  const points: PositionPoint[] = []
  for (const item of raw.readings) {
    const reading = sanitizeReading(item)
    if (!reading || reading.role !== 'visit') continue
    points.push({
      id: reading.id,
      courseId: reading.courseId,
      hole: reading.hole,
      target: reading.target,
      variant: reading.variant,
      lat: reading.lat,
      lng: reading.lng,
      accuracyM: reading.accuracyM,
      source: 'gps',
      createdAt: reading.timestamp,
    })
  }
  return points
}

/** Local readings win when the id is already on the phone. New local visits stay. */
export function mergePinPoints(published: readonly PositionPoint[], local: readonly PositionPoint[]): PositionPoint[] {
  const localIds = new Set(local.map((point) => point.id))
  const kept = published.filter((point) => !localIds.has(point.id))
  return [...kept, ...local]
}

export async function loadBundledPoints(courseIds: readonly string[]): Promise<PositionPoint[]> {
  const lists = await Promise.all(courseIds.map(loadCourse))
  return lists.flat()
}

async function loadCourse(courseId: string): Promise<PositionPoint[]> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${courseId}-pins.json`)
    if (!response.ok) return []
    return pointsFromBundle(await response.json())
  } catch {
    return []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
