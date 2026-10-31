import { openDB } from 'idb'
import { emptyPersisted, sanitizePersisted } from './persist.ts'
import type { Persisted } from '../types.ts'

const DB_NAME = 'pinfall'
const STORE = 'kv'
const KEY = 'state'
const LOCAL_KEY = 'pinfall.v1'

async function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    },
  })
}

export async function loadState(): Promise<Persisted> {
  const fromIdb = await readIdb()
  const fromLocal = readLocal()
  if (fromIdb && fromLocal) return freshness(fromLocal) > freshness(fromIdb) ? fromLocal : fromIdb
  return fromIdb ?? fromLocal ?? emptyPersisted()
}

async function readIdb(): Promise<Persisted | null> {
  try {
    const db = await database()
    const stored: unknown = await db.get(STORE, KEY)
    return sanitizePersisted(stored)
  } catch {
    return null
  }
}

function readLocal(): Persisted | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    return sanitizePersisted(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function freshness(data: Persisted): number {
  let newest = 0
  for (const point of data.points) newest = Math.max(newest, point.createdAt)
  for (const round of data.rounds) newest = Math.max(newest, round.finishedAt ?? round.startedAt)
  return newest
}

export async function saveState(data: Persisted): Promise<void> {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // Private mode can refuse localStorage. IndexedDB may still succeed.
  }
  try {
    const db = await database()
    await db.put(STORE, data, KEY)
  } catch {
    // The localStorage copy is the fallback when IndexedDB is unavailable.
  }
}
