/** Mean Earth radius used for both haversine and the local tangent projection. */
export const EARTH_RADIUS_M = 6_371_008.8

/** International foot. */
export const METERS_PER_FOOT = 0.3048

export const METERS_TO_FEET = 1 / METERS_PER_FOOT

export interface LatLng {
  lat: number
  lng: number
}

export interface Enu {
  eastM: number
  northM: number
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Great-circle distance in meters on a sphere of EARTH_RADIUS_M.
 * Stable haversine using atan2.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  return EARTH_RADIUS_M * c
}

/** Project `point` into a local east/north frame around `origin`, in meters. */
export function toEnu(origin: LatLng, point: LatLng): Enu {
  const lat0 = toRadians(origin.lat)
  const northM = toRadians(point.lat - origin.lat) * EARTH_RADIUS_M
  const eastM = toRadians(point.lng - origin.lng) * EARTH_RADIUS_M * Math.cos(lat0)
  return { eastM, northM }
}

/** Inverse of `toEnu` for distances that are small compared with the Earth. */
export function fromEnu(origin: LatLng, eastM: number, northM: number): LatLng {
  const lat0 = toRadians(origin.lat)
  const lat = origin.lat + toDegrees(northM / EARTH_RADIUS_M)
  const cosLat = Math.cos(lat0)
  const lng = origin.lng + (Math.abs(cosLat) < 1e-12 ? 0 : toDegrees(eastM / (EARTH_RADIUS_M * cosLat)))
  return { lat, lng }
}

export function metersToFeet(meters: number): number {
  return meters * METERS_TO_FEET
}

export function feetToMeters(feet: number): number {
  return feet * METERS_PER_FOOT
}

/**
 * Rough 1-sigma uncertainty of a distance between two independent GPS fixes,
 * treating each accuracy as an isotropic radius.
 */
export function distanceUncertaintyMeters(accuracyA: number, accuracyB: number): number {
  return Math.sqrt(accuracyA * accuracyA + accuracyB * accuracyB)
}

function groupDigits(value: number): string {
  const negative = value < 0
  const [whole, frac] = Math.abs(value).toString().split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
}

/** Distance number only. The caller renders the unit separately. */
export function formatDistance(meters: number, unit: 'ft' | 'm'): string {
  if (!Number.isFinite(meters) || meters < 0) return '—'
  if (unit === 'm') {
    const value = meters < 100 ? Math.round(meters * 10) / 10 : Math.round(meters)
    return groupDigits(value)
  }
  return groupDigits(Math.round(metersToFeet(meters)))
}

export function formatAccuracy(meters: number, unit: 'ft' | 'm'): string {
  if (!Number.isFinite(meters) || meters < 0) return '—'
  if (unit === 'm') {
    const value = meters < 10 ? Math.round(meters * 10) / 10 : Math.round(meters)
    return `± ${groupDigits(value)} m`
  }
  return `± ${groupDigits(Math.round(metersToFeet(meters)))} ft`
}
