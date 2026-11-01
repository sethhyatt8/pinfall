import { describe, expect, it } from 'vitest'
import { IPHONE_CHROME_LOCATION_PATH, locationHelpText } from './location.ts'

describe('location help', () => {
  it('names the iPhone Chrome Settings path', () => {
    expect(IPHONE_CHROME_LOCATION_PATH).toBe(
      'Settings > Privacy & Security > Location Services > Chrome > While Using + Precise Location',
    )
    expect(locationHelpText('denied')).toContain(IPHONE_CHROME_LOCATION_PATH)
    expect(locationHelpText('unavailable')).toContain('reload')
  })
})
