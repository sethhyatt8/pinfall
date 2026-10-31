import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyPersisted } from './persist.ts'
import { loadState, peekState } from './storage.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadState', () => {
  it('paints from an empty record when IndexedDB never opens', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        return {
          addEventListener() {},
          removeEventListener() {},
          result: null,
          error: null,
        }
      },
    })
    const started = Date.now()
    const loaded = await loadState(40)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(loaded).toEqual(emptyPersisted())
    expect(peekState()).toEqual(emptyPersisted())
  })
})
