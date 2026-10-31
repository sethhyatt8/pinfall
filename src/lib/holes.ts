import { estimatePosition, type Estimate } from './average.ts'
import type {
  BasketId,
  CourseSeed,
  HoleSeed,
  OverrideMap,
  PositionPoint,
  StatOverride,
  TargetKind,
  TeeId,
  TeeSeed,
} from '../types.ts'

/** Map framing keeps the user on screen when they are within this of a pin. */
export const NEAR_PIN_M = 2_000

export interface TargetRef {
  courseId: string
  hole: number
  target: TargetKind
  variant: string
}

export function statKey(hole: number, tee: TeeId, basket: BasketId): string {
  return `${hole}:${tee}:${basket}`
}

export function selectionKey(courseId: string, hole: number): string {
  return `${courseId}:${hole}`
}

export function effectiveStat(
  seed: number | null,
  override: StatOverride | undefined,
  field: keyof StatOverride,
): number | null {
  if (override && Object.prototype.hasOwnProperty.call(override, field)) {
    const value = override[field]
    return typeof value === 'number' ? value : null
  }
  return seed
}

export function readOverride(
  overrides: OverrideMap,
  courseId: string,
  hole: number,
  tee: TeeId,
  basket: BasketId,
): StatOverride | undefined {
  return overrides[courseId]?.[statKey(hole, tee, basket)]
}

export function resolveTee(hole: HoleSeed, preferred: TeeId | undefined): TeeSeed {
  return hole.tees.find((tee) => tee.id === preferred) ?? hole.tees[0]
}

export function resolveBasket(hole: HoleSeed, preferred: BasketId | undefined): BasketId {
  if (preferred && hole.baskets.includes(preferred)) return preferred
  return hole.baskets[0]
}

export function listedPar(tee: TeeSeed, basket: BasketId, override: StatOverride | undefined): number | null {
  return effectiveStat(tee.par[basket] ?? null, override, 'par')
}

export function listedLengthFt(tee: TeeSeed, basket: BasketId, override: StatOverride | undefined): number | null {
  return effectiveStat(tee.lengthFt[basket] ?? null, override, 'lengthFt')
}

export function sameTarget(point: PositionPoint, target: TargetRef): boolean {
  return (
    point.courseId === target.courseId &&
    point.hole === target.hole &&
    point.target === target.target &&
    point.variant === target.variant
  )
}

export function pointsFor(points: readonly PositionPoint[], target: TargetRef): PositionPoint[] {
  return points.filter((point) => sameTarget(point, target))
}

export function estimateTarget(points: readonly PositionPoint[], target: TargetRef): Estimate | null {
  return estimatePosition(
    pointsFor(points, target).map((point) => ({
      lat: point.lat,
      lng: point.lng,
      accuracyM: point.accuracyM,
    })),
  )
}

export function savedPinCount(course: CourseSeed, points: readonly PositionPoint[]): number {
  let count = 0
  for (const hole of course.holes) {
    for (const tee of hole.tees) {
      if (estimateTarget(points, { courseId: course.id, hole: hole.number, target: 'tee', variant: tee.id })) {
        count += 1
      }
    }
    for (const basket of hole.baskets) {
      if (
        estimateTarget(points, {
          courseId: course.id,
          hole: hole.number,
          target: 'basket',
          variant: basket,
        })
      ) {
        count += 1
      }
    }
  }
  return count
}

export function basketSlotCount(course: CourseSeed): number {
  return course.holes.reduce((sum, hole) => sum + hole.baskets.length, 0)
}

export function shortHoleLabel(label: string): string {
  const parts = label.split(' ')
  return parts[parts.length - 1] ?? label
}

export function hasStatOverride(override: StatOverride | undefined): boolean {
  if (!override) return false
  return Object.prototype.hasOwnProperty.call(override, 'par') || Object.prototype.hasOwnProperty.call(override, 'lengthFt')
}
