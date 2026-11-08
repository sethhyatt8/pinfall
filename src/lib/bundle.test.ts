import { describe, expect, it } from 'vitest'
import brandywineRaw from '../../public/data/brandywine-pins.json?raw'
import tamanendRaw from '../../public/data/tamanend-pins.json?raw'
import tylerRaw from '../../public/data/tyler-pins.json?raw'
import { mergePinPoints, pointsFromBundle } from './bundle.ts'
import type { PositionPoint } from '../types.ts'

describe('published pins', () => {
  it('ships every Tamanend tee and basket and no other course', () => {
    const tamanend = pointsFromBundle(JSON.parse(tamanendRaw))
    expect(tamanend).toHaveLength(18)
    expect(tamanend.every((point) => point.courseId === 'tamanend' && point.source === 'gps')).toBe(true)
    for (let hole = 1; hole <= 9; hole += 1) {
      expect(tamanend.some((point) => point.hole === hole && point.target === 'tee' && point.variant === 'main')).toBe(true)
      expect(tamanend.some((point) => point.hole === hole && point.target === 'basket' && point.variant === 'A')).toBe(true)
    }
    const hole5 = tamanend.find((point) => point.hole === 5 && point.target === 'tee')
    expect(hole5?.lat).toBeCloseTo(40.178546746708996, 6)
    expect(tamanend.some((point) => point.id === '75c46a97-e34d-457f-95ab-d01a0e6c4151')).toBe(false)
    expect(pointsFromBundle(JSON.parse(brandywineRaw))).toEqual([])
    expect(pointsFromBundle(JSON.parse(tylerRaw))).toEqual([])
  })

  it('keeps one copy when the phone already has that reading id', () => {
    const published: PositionPoint = {
      id: 'same',
      courseId: 'tamanend',
      hole: 1,
      target: 'tee',
      variant: 'main',
      lat: 1,
      lng: 2,
      accuracyM: 5,
      source: 'gps',
      createdAt: 1,
    }
    const local: PositionPoint = { ...published, lat: 9 }
    const extra: PositionPoint = { ...published, id: 'new', lat: 3 }
    const merged = mergePinPoints([published], [local, extra])
    expect(merged.map((point) => point.id)).toEqual(['same', 'new'])
    expect(merged[0]?.lat).toBe(9)
  })
})
