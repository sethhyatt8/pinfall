export type UnitSystem = 'ft' | 'm'

export type TeeId = 'main' | 'S' | 'ALT'

export type BasketId = 'A' | 'B'

export type TargetKind = 'tee' | 'basket'

export interface TeeSeed {
  id: TeeId
  label: string
  /** Listed length in feet. Missing basket means that basket does not exist. null means unknown. */
  lengthFt: Partial<Record<BasketId, number | null>>
  par: Partial<Record<BasketId, number | null>>
}

export interface HoleSeed {
  number: number
  /** "7", "East 7", "West 1", and so on. */
  label: string
  tees: TeeSeed[]
  baskets: BasketId[]
}

export interface LayoutGroup {
  name: string
  holeNumbers: number[]
}

export interface CourseSeed {
  id: string
  name: string
  shortName: string
  place: string
  summary: string
  /** Camera target only. Never written into saved tee or basket points. */
  center: { lat: number; lng: number }
  centerNote: string
  /** Course total when per-hole lengths are not known. */
  totalLengthFt?: number
  holes: HoleSeed[]
  layouts: LayoutGroup[]
}

export interface StatOverride {
  par?: number | null
  lengthFt?: number | null
}

/** courseId -> `${hole}:${tee}:${basket}` -> override */
export type OverrideMap = Record<string, Record<string, StatOverride>>

export interface PositionPoint {
  id: string
  courseId: string
  hole: number
  target: TargetKind
  variant: string
  lat: number
  lng: number
  accuracyM: number
  source: 'gps' | 'drag'
  createdAt: number
}

/** One GPS sample from a hold-still visit. `visitId` is the averaged point. */
export interface RawFix {
  id: string
  visitId: string
  courseId: string
  hole: number
  target: TargetKind
  variant: string
  lat: number
  lng: number
  accuracyM: number
  timestamp: number
}

export interface DriveMark {
  lat: number
  lng: number
  accuracyM: number
  timestamp: number
}

/** Photo or video metadata. The bytes live in IndexedDB, not in this object. */
export interface AttachmentMeta {
  id: string
  hole: number
  name: string
  mime: string
  size: number
  createdAt: number
}

export interface Round {
  id: string
  courseId: string
  startedAt: number
  finishedAt?: number
  /** Hole number string -> strokes. */
  strokes: Record<string, number>
  /** Hole the player should resume on. */
  hole?: number
  /** Hole number string -> where the drive landed. */
  drives?: Record<string, DriveMark>
  attachments?: AttachmentMeta[]
}

export interface Settings {
  units: UnitSystem
  lastCourseId: string | null
  lastHoleByCourse: Record<string, number>
  /** Key `${courseId}:${hole}` */
  lastTee: Record<string, TeeId>
  lastBasket: Record<string, BasketId>
  installHintDismissed: boolean
}

export interface Persisted {
  version: 1
  settings: Settings
  points: PositionPoint[]
  /** Every fix from a visit. Older saves have none; the averaged point is still in `points`. */
  fixes: RawFix[]
  rounds: Round[]
  overrides: OverrideMap
}

export interface GpsFix {
  lat: number
  lng: number
  accuracyM: number
  timestamp?: number
}
