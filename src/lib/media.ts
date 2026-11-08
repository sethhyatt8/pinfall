export type MediaSaveResult = { ok: true } | { ok: false; reason: 'unsupported' | 'full' | 'failed' }

const DB_NAME = 'pinfall-media'
const STORE = 'blobs'

function openMediaDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('unsupported'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('failed'))
  })
}

export async function saveMedia(id: string, blob: Blob): Promise<MediaSaveResult> {
  try {
    // WebKit rejects Blob values in IndexedDB. The bytes themselves store reliably.
    const bytes = await blob.arrayBuffer()
    const db = await openMediaDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(bytes, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('failed'))
      tx.onabort = () => reject(tx.error ?? new Error('failed'))
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: mediaReason(error) }
  }
}

export async function loadMedia(id: string): Promise<Blob | null> {
  try {
    const db = await openMediaDb()
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('failed'))
    })
    if (value instanceof Blob) return value
    if (value instanceof ArrayBuffer) return new Blob([value])
    return null
  } catch {
    return null
  }
}

export async function deleteMedia(id: string): Promise<void> {
  try {
    const db = await openMediaDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('failed'))
    })
  } catch {
    // The score does not depend on the photo file being removed.
  }
}

export function mediaErrorText(reason: 'unsupported' | 'full' | 'failed'): string {
  if (reason === 'unsupported') return 'This browser can’t store photos. The score is still saved.'
  if (reason === 'full') return 'This phone is full. The score is saved. The photo was not.'
  return 'The photo could not be stored. The score is still saved.'
}

function mediaReason(error: unknown): 'unsupported' | 'full' | 'failed' {
  if (error instanceof Error && error.message === 'unsupported') return 'unsupported'
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) return 'full'
  return 'failed'
}
