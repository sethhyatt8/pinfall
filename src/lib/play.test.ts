import { describe, expect, it } from 'vitest'
import { driveFeet, liveFeet } from './play.ts'
import type { PositionPoint } from '../types.ts'

describe('play distances', () => {
  const basket = { lat: 40.18, lng: -75.035 }
  const here = { lat: 40.181, lng: -75.035 }

  it('reports feet only when both the phone and a basket exist', () => {
    const feet = liveFeet(here, basket)
    expect(feet).toBeGreaterThan(300)
    expect(liveFeet(null, basket)).toBeNull()
    expect(liveFeet(here, null)).toBeNull()
  })

  it('leaves drive feet blank when the tee was never saved', () => {
    const drive = { lat: 40.1805, lng: -75.035, accuracyM: 4, timestamp: 1 }
    expect(driveFeet([], 'tamanend', 1, 'main', 'A', drive)).toEqual({ driveFt: null, remainingFt: null })
    const tee: PositionPoint = {
      id: 't',
      courseId: 'tamanend',
      hole: 1,
      target: 'tee',
      variant: 'main',
      lat: 40.18,
      lng: -75.035,
      accuracyM: 3,
      source: 'gps',
      createdAt: 1,
    }
    const pin: PositionPoint = { ...tee, id: 'b', target: 'basket', variant: 'A', lat: 40.181 }
    const result = driveFeet([tee, pin], 'tamanend', 1, 'main', 'A', drive)
    expect(result.driveFt).toBeGreaterThan(100)
    expect(result.remainingFt).toBeGreaterThan(100)
  })
})
