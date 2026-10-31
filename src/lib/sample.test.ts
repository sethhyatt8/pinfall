import { describe, expect, it } from 'vitest'
import { fromEnu } from './geo.ts'
import {
  finalizeSample,
  isAcceptedFix,
  MAX_ACCEPT_ACCURACY_M,
  MIN_GOOD_FIXES,
  SAMPLE_MAX_MS,
  SAMPLE_MIN_MS,
  shouldEndSample,
} from './sample.ts'

const origin = { lat: 40.18, lng: -75.035 }

function fix(accuracyM: number, east = 0, north = 0) {
  return { ...fromEnu(origin, east, north), accuracyM }
}

describe('sample selection', () => {
  it('drops weak, empty, and impossible fixes', () => {
    expect(isAcceptedFix(fix(5))).toBe(true)
    expect(isAcceptedFix(fix(MAX_ACCEPT_ACCURACY_M))).toBe(true)
    expect(isAcceptedFix(fix(MAX_ACCEPT_ACCURACY_M + 0.1))).toBe(false)
    expect(isAcceptedFix({ lat: 1, lng: 1, accuracyM: Number.NaN })).toBe(false)
    expect(isAcceptedFix({ lat: 120, lng: 1, accuracyM: 5 })).toBe(false)
  })

  it('saves an averaged visit once enough fixes agree', () => {
    const result = finalizeSample([fix(8), fix(6, 1, 0), fix(5, 0, 1), fix(40), fix(0)])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.usedCount).toBe(3)
    expect(result.poorCount).toBe(2)
    expect(result.outlierCount).toBe(0)
    expect(result.accuracyM).toBeLessThan(8)
  })

  it('refuses a visit that does not have enough agreeing fixes', () => {
    const result = finalizeSample([fix(4), fix(4), fix(40)])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.goodCount).toBe(2)
    expect(result.reason).toContain(String(MIN_GOOD_FIXES))
  })

  it('does not let one jumped fix spoil an otherwise steady visit', () => {
    const result = finalizeSample([fix(4), fix(4, 1, 0), fix(4, 0, 1), fix(5, 80, 0)])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.outlierCount).toBe(1)
    expect(result.usedCount).toBe(3)
  })

  it('ends early only after the minimum window has a good visit', () => {
    const good = [fix(4), fix(4), fix(4)]
    expect(shouldEndSample(SAMPLE_MIN_MS - 1, good)).toBe(false)
    expect(shouldEndSample(SAMPLE_MIN_MS, good)).toBe(true)
    expect(shouldEndSample(SAMPLE_MIN_MS, [fix(4), fix(4)])).toBe(false)
    expect(shouldEndSample(SAMPLE_MAX_MS, [])).toBe(true)
  })
})
