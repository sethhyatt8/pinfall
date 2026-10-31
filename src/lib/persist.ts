import type {
  BasketId,
  OverrideMap,
  Persisted,
  PositionPoint,
  Round,
  Settings,
  StatOverride,
  TeeId,
} from '../types.ts'

const TEE_IDS: readonly TeeId[] = ['main', 'S', 'ALT']
const BASKET_IDS: readonly BasketId[] = ['A', 'B']

export function emptySettings(): Settings {
  return {
    units: 'ft',
    lastCourseId: null,
    lastHoleByCourse: {},
    lastTee: {},
    lastBasket: {},
    installHintDismissed: false,
  }
}

export function emptyPersisted(): Persisted {
  return {
    version: 1,
    settings: emptySettings(),
    points: [],
    rounds: [],
    overrides: {},
  }
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
}

export function serializeExport(data: Persisted, exportedAt = new Date().toISOString()): string {
  return JSON.stringify(
    {
      app: 'pinfall',
      version: 1,
      exportedAt,
      settings: data.settings,
      points: data.points,
      rounds: data.rounds,
      overrides: data.overrides,
    },
    null,
    2,
  )
}

export function parseImport(json: string): { ok: true; data: Persisted } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!isRecord(raw) || raw.app !== 'pinfall' || raw.version !== 1) {
    return { ok: false, error: 'This file is not a Pinfall backup (version 1).' }
  }
  const data = sanitizePersisted(raw)
  if (!data) return { ok: false, error: 'The backup is missing course data.' }
  return { ok: true, data }
}

export function sanitizePersisted(raw: unknown): Persisted | null {
  if (!isRecord(raw)) return null
  const settings = sanitizeSettings(raw.settings)
  const points = sanitizePoints(raw.points)
  const rounds = sanitizeRounds(raw.rounds)
  const overrides = sanitizeOverrides(raw.overrides)
  if (!settings || !points || !rounds || !overrides) return null
  return { version: 1, settings, points, rounds, overrides }
}

function sanitizeSettings(raw: unknown): Settings | null {
  const base = emptySettings()
  if (raw == null) return base
  if (!isRecord(raw)) return null
  if (raw.units === 'ft' || raw.units === 'm') base.units = raw.units
  if (typeof raw.lastCourseId === 'string' && raw.lastCourseId.length < 80) base.lastCourseId = raw.lastCourseId
  base.lastHoleByCourse = numberMap(raw.lastHoleByCourse, (value) =>
    Number.isInteger(value) && value >= 1 && value <= 99 ? value : null,
  )
  base.lastTee = stringMap(raw.lastTee, (value) => (TEE_IDS.includes(value as TeeId) ? (value as TeeId) : null))
  base.lastBasket = stringMap(raw.lastBasket, (value) =>
    BASKET_IDS.includes(value as BasketId) ? (value as BasketId) : null,
  )
  base.installHintDismissed = raw.installHintDismissed === true
  return base
}

function sanitizePoints(raw: unknown): PositionPoint[] | null {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > 5000) return null
  const points: PositionPoint[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const lat = item.lat
    const lng = item.lng
    const accuracyM = item.accuracyM
    const hole = item.hole
    if (typeof item.id !== 'string' || typeof item.courseId !== 'string') continue
    if (item.target !== 'tee' && item.target !== 'basket') continue
    if (typeof item.variant !== 'string' || item.variant.length === 0 || item.variant.length > 20) continue
    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    if (typeof accuracyM !== 'number' || !Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > 10000) continue
    if (typeof hole !== 'number' || !Number.isInteger(hole) || hole < 1 || hole > 99) continue
    if (item.source !== 'gps' && item.source !== 'drag') continue
    if (typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt)) continue
    points.push({
      id: item.id,
      courseId: item.courseId,
      hole,
      target: item.target,
      variant: item.variant,
      lat,
      lng,
      accuracyM,
      source: item.source,
      createdAt: item.createdAt,
    })
  }
  return points
}

function sanitizeRounds(raw: unknown): Round[] | null {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > 500) return null
  const rounds: Round[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.courseId !== 'string') continue
    if (typeof item.startedAt !== 'number') continue
    if (!isRecord(item.strokes)) continue
    const strokes: Record<string, number> = {}
    for (const [hole, value] of Object.entries(item.strokes)) {
      if (!/^\d+$/.test(hole)) continue
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 99) continue
      strokes[hole] = value
    }
    const round: Round = {
      id: item.id,
      courseId: item.courseId,
      startedAt: item.startedAt,
      strokes,
    }
    if (typeof item.finishedAt === 'number') round.finishedAt = item.finishedAt
    rounds.push(round)
  }
  return rounds
}

function sanitizeOverrides(raw: unknown): OverrideMap | null {
  if (raw == null) return {}
  if (!isRecord(raw)) return null
  const overrides: OverrideMap = {}
  for (const [courseId, courseValue] of Object.entries(raw)) {
    if (!isRecord(courseValue)) continue
    const courseOverrides: Record<string, StatOverride> = {}
    for (const [key, statValue] of Object.entries(courseValue)) {
      if (!/^\d+:(main|S|ALT):(A|B)$/.test(key) || !isRecord(statValue)) continue
      const stat: StatOverride = {}
      if ('par' in statValue) {
        if (statValue.par == null) stat.par = null
        else if (typeof statValue.par === 'number' && Number.isInteger(statValue.par) && statValue.par >= 1 && statValue.par <= 12) {
          stat.par = statValue.par
        }
      }
      if ('lengthFt' in statValue) {
        if (statValue.lengthFt == null) stat.lengthFt = null
        else if (
          typeof statValue.lengthFt === 'number' &&
          statValue.lengthFt >= 1 &&
          statValue.lengthFt <= 5000
        ) {
          stat.lengthFt = statValue.lengthFt
        }
      }
      if ('par' in stat || 'lengthFt' in stat) courseOverrides[key] = stat
    }
    overrides[courseId] = courseOverrides
  }
  return overrides
}

function numberMap(raw: unknown, accept: (value: number) => number | null): Record<string, number> {
  if (!isRecord(raw)) return {}
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number') continue
    const accepted = accept(value)
    if (accepted == null) continue
    result[key] = accepted
  }
  return result
}

function stringMap<T extends string>(raw: unknown, accept: (value: string) => T | null): Record<string, T> {
  if (!isRecord(raw)) return {}
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue
    const accepted = accept(value)
    if (accepted == null) continue
    result[key] = accepted
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
