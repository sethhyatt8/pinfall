import { describe, expect, it } from 'vitest'
import { estimatePosition, MIN_ACCURACY_M } from './average.ts'
import { fromEnu, toEnu } from './geo.ts'

const origin = { lat: 39.80437, lng: -75.57828 }

describe('estimatePosition', () => {
  it('returns null when nothing is usable', () => {
    expect(estimatePosition([])).toBeNull()
    expect(estimatePosition([{ lat: 0, lng: 0, accuracyM: 0 }])).toBeNull()
    expect(estimatePosition([{ lat: Number.NaN, lng: 0, accuracyM: 5 }])).toBeNull()
    expect(estimatePosition([{ lat: 91, lng: 0, accuracyM: 5 }])).toBeNull()
  })

  it('returns a single point and refuses sub-meter claims', () => {
    const estimate = estimatePosition([{ ...origin, accuracyM: 0.1 }])
    expect(estimate).toMatchObject({
      lat: origin.lat,
      lng: origin.lng,
      errorRadiusM: MIN_ACCURACY_M,
      usedCount: 1,
      rejectedCount: 0,
    })
  })

  it('shrinks the formal error when two identical readings agree', () => {
    const estimate = estimatePosition([
      { ...origin, accuracyM: 4 },
      { ...origin, accuracyM: 4 },
    ])
    expect(estimate?.usedCount).toBe(2)
    expect(estimate?.rejectedCount).toBe(0)
    // 1 / sqrt(1/16 + 1/16) = sqrt(8)
    expect(estimate?.errorRadiusM).toBeCloseTo(Math.sqrt(8), 6)
    expect(toEnu(origin, estimate!).eastM).toBeCloseTo(0, 4)
    expect(toEnu(origin, estimate!).northM).toBeCloseTo(0, 4)
  })

  it('lets the tighter reading dominate the mean', () => {
    const east = fromEnu(origin, 10, 0)
    const estimate = estimatePosition([
      { ...origin, accuracyM: 1 },
      { ...east, accuracyM: 10 },
    ])
    const local = toEnu(origin, estimate!)
    // weights 1 and 0.01 → 10 * 0.01 / 1.01
    expect(local.eastM).toBeCloseTo(10 / 101, 2)
    expect(local.northM).toBeCloseTo(0, 2)
    expect(estimate?.rejectedCount).toBe(0)
  })

  it('rejects a point that is far beyond its own accuracy', () => {
    const cluster = [-1, 0, 1].map((north) => ({ ...fromEnu(origin, 0, north), accuracyM: 5 }))
    const far = { ...fromEnu(origin, 100, 0), accuracyM: 5 }
    const estimate = estimatePosition([...cluster, far])
    expect(estimate?.rejectedCount).toBe(1)
    expect(estimate?.usedCount).toBe(3)
    const local = toEnu(origin, estimate!)
    expect(Math.hypot(local.eastM, local.northM)).toBeLessThan(2)
  })

  it('keeps a loose reading and gives it very little pull', () => {
    const loose = { ...fromEnu(origin, 10, 0), accuracyM: 30 }
    const estimate = estimatePosition([{ ...origin, accuracyM: 3 }, loose])
    expect(estimate?.rejectedCount).toBe(0)
    expect(estimate?.usedCount).toBe(2)
    // weights 1/9 and 1/900 → shift 10/101 m
    expect(toEnu(origin, estimate!).eastM).toBeCloseTo(10 / 101, 2)
  })

  it('treats a dragged guess as a low-weight hint', () => {
    const guess = { ...fromEnu(origin, 0, 30), accuracyM: 50 }
    const estimate = estimatePosition([{ ...origin, accuracyM: 4 }, guess])
    const gpsWeight = 1 / 16
    const guessWeight = 1 / 2500
    const expectedNorth = (30 * guessWeight) / (gpsWeight + guessWeight)
    const local = toEnu(origin, estimate!)
    expect(local.northM).toBeCloseTo(expectedNorth, 2)
    expect(local.eastM).toBeCloseTo(0, 2)
    expect(expectedNorth).toBeLessThan(0.25)
  })
})
