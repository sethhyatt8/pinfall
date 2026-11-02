import { describe, expect, it } from 'vitest'
import { getCourse, getHole } from '../data/courses.ts'
import { defaultTee } from './holes.ts'
import { mergeCourseReadings } from './merge-readings.ts'
import { emptyPersisted } from './persist.ts'
import { exportReadings, parseReadingsExport, serializeReadings } from './readings.ts'

describe('readings export', () => {
  it('includes saved visits and every fix sample', () => {
    const data = emptyPersisted()
    data.points.push({
      id: 'visit-old',
      courseId: 'brandywine',
      hole: 1,
      target: 'tee',
      variant: 'main',
      lat: 39.8,
      lng: -75.57,
      accuracyM: 6,
      source: 'gps',
      createdAt: 10,
    })
    data.points.push({
      id: 'drag',
      courseId: 'brandywine',
      hole: 1,
      target: 'basket',
      variant: 'A',
      lat: 39.8,
      lng: -75.57,
      accuracyM: 50,
      source: 'drag',
      createdAt: 11,
    })
    data.fixes.push({
      id: 'fix-1',
      visitId: 'visit-old',
      courseId: 'brandywine',
      hole: 1,
      target: 'tee',
      variant: 'main',
      lat: 39.8001,
      lng: -75.5701,
      accuracyM: 4,
      timestamp: 9,
    })
    const exported = exportReadings(data, '2026-11-02T00:00:00.000Z')
    expect(exported.readings.map((reading) => reading.id)).toEqual(['visit-old', 'fix-1'])
    const parsed = parseReadingsExport(serializeReadings(data, '2026-11-02T00:00:00.000Z'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.readings).toHaveLength(2)
  })
})

describe('merge readings', () => {
  it('dedupes by id and rejects a distant outlier', () => {
    const keep = {
      id: 'fix-a',
      role: 'fix' as const,
      visitId: 'v',
      courseId: 'brandywine',
      hole: 3,
      target: 'basket' as const,
      variant: 'A',
      lat: 39.8,
      lng: -75.57,
      accuracyM: 4,
      timestamp: 1,
    }
    const duplicate = { ...keep, lat: 0 }
    const near = { ...keep, id: 'fix-b', lat: 39.80002, timestamp: 2 }
    const far = { ...keep, id: 'fix-c', lat: 39.81, accuracyM: 3, timestamp: 3 }
    const merged = mergeCourseReadings([keep], [duplicate, near, far])
    expect(merged?.readings.map((reading) => reading.id).sort()).toEqual(['fix-a', 'fix-b', 'fix-c'])
    expect(merged?.readings.find((reading) => reading.id === 'fix-a')?.lat).toBe(39.8)
    const pin = merged?.pins[0]
    expect(pin?.rejectedCount).toBeGreaterThan(0)
    expect(pin?.lat).toBeCloseTo(39.8, 3)
  })
})

describe('default tee', () => {
  it('uses the main tee, or the shorter pad when a hole has two', () => {
    const course = getCourse('brandywine')!
    expect(defaultTee(getHole(course, 1)!).id).toBe('main')
    expect(defaultTee(getHole(course, 2)!).id).toBe('S')
    expect(defaultTee(getHole(course, 12)!).id).toBe('ALT')
  })
})
