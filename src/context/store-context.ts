import { createContext, useContext } from 'react'
import type {
  AttachmentMeta,
  BasketId,
  DriveMark,
  GpsFix,
  Persisted,
  PositionPoint,
  StatOverride,
  TargetKind,
  TeeId,
  UnitSystem,
} from '../types.ts'

export interface StoreApi {
  data: Persisted
  /** Published pins plus this phone's readings, with duplicate ids removed. */
  mergedPoints: PositionPoint[]
  pinsReady: boolean
  setUnits: (units: UnitSystem) => void
  dismissInstallHint: () => void
  rememberHole: (courseId: string, hole: number, tee: TeeId, basket: BasketId) => void
  addGpsPoint: (point: Omit<PositionPoint, 'id' | 'createdAt' | 'source'>, fixes?: GpsFix[]) => void
  deletePoint: (id: string) => void
  clearTarget: (courseId: string, hole: number, target: TargetKind, variant: string) => void
  upsertGuess: (
    courseId: string,
    hole: number,
    target: TargetKind,
    variant: string,
    lat: number,
    lng: number,
  ) => void
  setStatOverride: (
    courseId: string,
    hole: number,
    tee: TeeId,
    basket: BasketId,
    stat: StatOverride,
  ) => void
  clearStatOverride: (courseId: string, hole: number, tee: TeeId, basket: BasketId) => void
  setStrokes: (courseId: string, hole: number, strokes: number | null) => void
  setRoundHole: (courseId: string, hole: number) => void
  setDrive: (courseId: string, hole: number, drive: DriveMark | null) => void
  addAttachment: (courseId: string, attachment: AttachmentMeta) => void
  removeAttachment: (courseId: string, attachmentId: string) => void
  finishRound: (courseId: string) => void
  discardActiveRound: (courseId: string) => void
  replaceAll: (data: Persisted) => void
  eraseAll: () => void
}

export const StoreContext = createContext<StoreApi | null>(null)

export function useStore(): StoreApi {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Store is not ready')
  return value
}
