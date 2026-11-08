import { describe, expect, it } from 'vitest'
import { getCourse } from '../data/courses.ts'
import { effectiveStat } from './holes.ts'
import { emptyPersisted, parseImport, serializeExport } from './persist.ts'
import { formatRelative, roundTotals } from './scoring.ts'
import type { PositionPoint } from '../types.ts'

describe('backup import', () => {
  it('round-trips saved pins and rejects anything that is not a Pinfall file', () => {
    const point: PositionPoint = {
      id: 'p1',
      courseId: 'brandywine',
      hole: 7,
      target: 'basket',
      variant: 'A',
      lat: 39.8,
      lng: -75.57,
      accuracyM: 4.2,
      source: 'gps',
      createdAt: 1_700_000_000_000,
    }
    const data = emptyPersisted()
    data.points = [point]
    data.settings.units = 'm'
    const parsed = parseImport(serializeExport(data, '2026-10-31T00:00:00.000Z'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.points).toEqual([point])
    expect(parsed.data.settings.units).toBe('m')
    expect(parseImport('{').ok).toBe(false)
    expect(parseImport('{"app":"other","version":1}').ok).toBe(false)
  })

  it('drops a coordinate that cannot be a real fix and keeps the rest', () => {
    const json = JSON.stringify({
      app: 'pinfall',
      version: 1,
      points: [
        {
          id: 'bad',
          courseId: 'tyler',
          hole: 1,
          target: 'tee',
          variant: 'main',
          lat: 400,
          lng: 10,
          accuracyM: 5,
          source: 'gps',
          createdAt: 1,
        },
        {
          id: 'good',
          courseId: 'tyler',
          hole: 19,
          target: 'basket',
          variant: 'A',
          lat: 40.23,
          lng: -74.96,
          accuracyM: 6,
          source: 'drag',
          createdAt: 2,
        },
      ],
    })
    const parsed = parseImport(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.points.map((point) => point.id)).toEqual(['good'])
  })
})

describe('round fields', () => {
  it('keeps strokes, a drive, and photo names without storing the photo bytes', () => {
    const json = JSON.stringify({
      app: 'pinfall',
      version: 1,
      rounds: [
        {
          id: 'r1',
          courseId: 'tamanend',
          startedAt: 10,
          hole: 3,
          strokes: { '1': 3, '2': 4 },
          drives: { '1': { lat: 40.18, lng: -75.03, accuracyM: 4, timestamp: 11 } },
          attachments: [{ id: 'a1', hole: 1, name: 'disc.jpg', mime: 'image/jpeg', size: 1200, createdAt: 12 }],
        },
      ],
    })
    const parsed = parseImport(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const round = parsed.data.rounds[0]
    expect(round?.hole).toBe(3)
    expect(round?.drives?.['1']?.lat).toBe(40.18)
    expect(round?.attachments?.[0]?.name).toBe('disc.jpg')
    expect(JSON.stringify(parsed.data)).not.toContain('base64')
    expect(serializeExport(parsed.data)).not.toContain('data:')
  })
})

describe('listed stats and score', () => {
  it('lets an edit replace the seeded par without inventing a length', () => {
    expect(effectiveStat(3, undefined, 'par')).toBe(3)
    expect(effectiveStat(3, { par: 4 }, 'par')).toBe(4)
    expect(effectiveStat(280, { par: 4 }, 'lengthFt')).toBe(280)
    expect(effectiveStat(280, { lengthFt: null }, 'lengthFt')).toBeNull()
  })

  it('scores a Brandywine round against the seeded pars', () => {
    const course = getCourse('brandywine')!
    const data = emptyPersisted()
    const round = {
      id: 'r1',
      courseId: course.id,
      startedAt: 1,
      strokes: { '1': 3, '5': 5 },
    }
    const totals = roundTotals(course, round, data.settings, data.overrides)
    expect(totals).toEqual({ strokes: 8, scoredHoles: 2, parStrokes: 7, parHoles: 2 })
    expect(formatRelative(totals.strokes, totals.parStrokes)).toBe('+1')
    expect(formatRelative(3, 3)).toBe('E')
    expect(formatRelative(2, 3)).toBe('-1')
  })
})
