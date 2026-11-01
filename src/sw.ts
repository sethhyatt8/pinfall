import { cleanupOutdatedCaches, matchPrecache, precache } from 'workbox-precaching'
import { setCacheNameDetails } from 'workbox-core'

// Bump the precache name so a worker left over from the first deploy is replaced.
setCacheNameDetails({ prefix: 'pinfall', precache: 'precache-v4' })

precache(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const CACHE_LIMIT_MS = 1500

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  // Map tiles and other origins stay on the network. A hung tile must not enter this worker.
  if (new URL(request.url).origin !== self.location.origin) return
  event.respondWith(networkFirst(request))
})

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request)
    // WebKit rejects respondWith() of a redirected response and can stall the load.
    return await unpack(response)
  } catch {
    const cached = await Promise.race([
      cachedResponse(request),
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), CACHE_LIMIT_MS)
      }),
    ])
    if (cached) return cached
    return new Response('Offline', {
      status: 503,
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
    })
  }
}

async function cachedResponse(request: Request): Promise<Response | undefined> {
  const direct = await matchPrecache(request.url)
  if (direct) return direct
  if (request.mode === 'navigate') {
    return matchPrecache(new URL('index.html', self.location.href).href)
  }
  return undefined
}

async function unpack(response: Response): Promise<Response> {
  const headers = new Headers(response.headers)
  const body = await response.arrayBuffer()
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
