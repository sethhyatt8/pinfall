import { describe, expect, it } from 'vitest'
import { mediaErrorText, saveMedia } from './media.ts'

describe('photo storage', () => {
  it('says the score is kept when photos cannot be stored', async () => {
    const result = await saveMedia('photo-1', new Blob(['not-a-real-image']))
    expect(result).toEqual({ ok: false, reason: 'unsupported' })
    expect(mediaErrorText('unsupported')).toContain('score is still saved')
    expect(mediaErrorText('full')).toContain('phone is full')
    expect(mediaErrorText('failed')).toContain('score is still saved')
  })
})
