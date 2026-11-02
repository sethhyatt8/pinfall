import type { Persisted, TargetKind } from '../types.ts'

export interface ReadingRecord {
  id: string
  role: 'fix' | 'visit'
  visitId?: string
  courseId: string
  hole: number
  target: TargetKind
  variant: string
  lat: number
  lng: number
  accuracyM: number
  timestamp: number
}

export interface ReadingsExport {
  app: 'pinfall'
  kind: 'readings'
  version: 1
  exportedAt: string
  readings: ReadingRecord[]
}

export function exportReadings(data: Persisted, exportedAt = new Date().toISOString()): ReadingsExport {
  const readings: ReadingRecord[] = []
  for (const point of data.points) {
    if (point.source !== 'gps') continue
    readings.push({
      id: point.id,
      role: 'visit',
      courseId: point.courseId,
      hole: point.hole,
      target: point.target,
      variant: point.variant,
      lat: point.lat,
      lng: point.lng,
      accuracyM: point.accuracyM,
      timestamp: point.createdAt,
    })
  }
  for (const fix of data.fixes) {
    readings.push({
      id: fix.id,
      role: 'fix',
      visitId: fix.visitId,
      courseId: fix.courseId,
      hole: fix.hole,
      target: fix.target,
      variant: fix.variant,
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: fix.accuracyM,
      timestamp: fix.timestamp,
    })
  }
  return { app: 'pinfall', kind: 'readings', version: 1, exportedAt, readings }
}

export function serializeReadings(data: Persisted, exportedAt = new Date().toISOString()): string {
  return JSON.stringify(exportReadings(data, exportedAt), null, 2)
}

export function parseReadingsExport(json: string): { ok: true; data: ReadingsExport } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!isRecord(raw) || raw.app !== 'pinfall' || raw.kind !== 'readings' || raw.version !== 1) {
    return { ok: false, error: 'This file is not a Pinfall readings export.' }
  }
  if (!Array.isArray(raw.readings)) return { ok: false, error: 'The export has no readings list.' }
  const readings: ReadingRecord[] = []
  for (const item of raw.readings) {
    const reading = sanitizeReading(item)
    if (reading) readings.push(reading)
  }
  return {
    ok: true,
    data: {
      app: 'pinfall',
      kind: 'readings',
      version: 1,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      readings,
    },
  }
}

export function sanitizeReading(item: unknown): ReadingRecord | null {
  if (!isRecord(item)) return null
  if (item.role !== 'fix' && item.role !== 'visit') return null
  if (typeof item.id !== 'string' || typeof item.courseId !== 'string') return null
  if (item.target !== 'tee' && item.target !== 'basket') return null
  if (typeof item.variant !== 'string' || item.variant.length === 0) return null
  if (typeof item.hole !== 'number' || !Number.isInteger(item.hole)) return null
  if (typeof item.lat !== 'number' || item.lat < -90 || item.lat > 90) return null
  if (typeof item.lng !== 'number' || item.lng < -180 || item.lng > 180) return null
  if (typeof item.accuracyM !== 'number' || !(item.accuracyM > 0)) return null
  if (typeof item.timestamp !== 'number' || !Number.isFinite(item.timestamp)) return null
  const reading: ReadingRecord = {
    id: item.id,
    role: item.role,
    courseId: item.courseId,
    hole: item.hole,
    target: item.target,
    variant: item.variant,
    lat: item.lat,
    lng: item.lng,
    accuracyM: item.accuracyM,
    timestamp: item.timestamp,
  }
  if (typeof item.visitId === 'string') reading.visitId = item.visitId
  return reading
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
