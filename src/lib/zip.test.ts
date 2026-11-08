import { describe, expect, it } from 'vitest'
import { zipStore } from './zip.ts'

describe('round zip', () => {
  it('stores the round file and the attachment uncompressed', () => {
    const bytes = zipStore([
      { name: 'round.json', data: new TextEncoder().encode('{"strokes":{"1":3}}') },
      { name: 'files/hole-1-photo.txt', data: new TextEncoder().encode('photo') },
    ])
    expect(new TextDecoder().decode(readStored(bytes, 'round.json'))).toContain('"1":3')
    expect(new TextDecoder().decode(readStored(bytes, 'files/hole-1-photo.txt'))).toBe('photo')
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })
})

function readStored(zip: Uint8Array, name: string): Uint8Array {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const wanted = new TextEncoder().encode(name)
  let offset = 0
  while (offset + 30 <= zip.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extra = view.getUint16(offset + 28, true)
    const fileName = zip.subarray(offset + 30, offset + 30 + nameLength)
    const start = offset + 30 + nameLength + extra
    if (fileName.length === wanted.length && fileName.every((byte, index) => byte === wanted[index])) {
      return zip.subarray(start, start + size)
    }
    offset = start + size
  }
  throw new Error(`missing ${name}`)
}
