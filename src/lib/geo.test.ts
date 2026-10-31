import { describe, expect, it } from 'vitest'
import {
  EARTH_RADIUS_M,
  distanceUncertaintyMeters,
  feetToMeters,
  formatAccuracy,
  formatDistance,
  fromEnu,
  haversineMeters,
  metersToFeet,
  toEnu,
} from './geo.ts'

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    const point = { lat: 39.80437, lng: -75.57828 }
    expect(haversineMeters(point, point)).toBe(0)
  })

  it('is symmetric', () => {
    const a = { lat: 39.80437, lng: -75.57828 }
    const b = { lat: 40.18016, lng: -75.03501 }
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6)
  })

  it('matches the meridian arc for one degree of latitude', () => {
    const distance = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(distance).toBeCloseTo((EARTH_RADIUS_M * Math.PI) / 180, 3)
  })

  it('matches the equal-latitude formula for one degree of longitude', () => {
    const phi = (40 * Math.PI) / 180
    const dLambda = Math.PI / 180
    const expected = EARTH_RADIUS_M * 2 * Math.asin(Math.cos(phi) * Math.sin(dLambda / 2))
    const distance = haversineMeters({ lat: 40, lng: -75 }, { lat: 40, lng: -74 })
    expect(distance).toBeCloseTo(expected, 3)
  })

  it('agrees with the local tangent frame over a disc-golf distance', () => {
    const origin = { lat: 39.80437, lng: -75.57828 }
    const point = fromEnu(origin, 80, 60)
    const distance = haversineMeters(origin, point)
    expect(distance).toBeCloseTo(100, 2)
    const back = toEnu(origin, point)
    expect(back.eastM).toBeCloseTo(80, 2)
    expect(back.northM).toBeCloseTo(60, 2)
  })
})

describe('feet and display', () => {
  it('converts the international foot', () => {
    expect(feetToMeters(1)).toBeCloseTo(0.3048, 10)
    expect(metersToFeet(0.3048)).toBeCloseTo(1, 10)
    expect(metersToFeet(haversineMeters({ lat: 0, lng: 0 }, fromEnu({ lat: 0, lng: 0 }, 30.48, 0)))).toBeCloseTo(100, 1)
  })

  it('formats distances and accuracy without a locale', () => {
    expect(formatDistance(30.48, 'ft')).toBe('100')
    expect(formatDistance(12.34, 'm')).toBe('12.3')
    expect(formatDistance(1500, 'm')).toBe('1,500')
    expect(formatAccuracy(3, 'm')).toBe('± 3 m')
    expect(formatAccuracy(3.048, 'ft')).toBe('± 10 ft')
  })

  it('combines two accuracies in quadrature', () => {
    expect(distanceUncertaintyMeters(3, 4)).toBeCloseTo(5, 10)
  })
})
