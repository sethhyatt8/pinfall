import { useEffect, useRef, useState } from 'react'
import { ESRI_ATTRIBUTION } from '../lib/tiles.ts'
import { OfflineBanner, TopBar } from './Chrome.tsx'
import { Button, Dialog } from './ui.tsx'
import { useStore } from '../context/store-context.ts'
import { OUTLIER_FLOOR_M, OUTLIER_SIGMAS } from '../lib/average.ts'
import { parseImport, serializeExport } from '../lib/persist.ts'
import {
  MAX_ACCEPT_ACCURACY_M,
  MIN_GOOD_FIXES,
  ROUGH_GUESS_ACCURACY_M,
  SAMPLE_MAX_MS,
  SAMPLE_MIN_MS,
} from '../lib/sample.ts'
import type { Persisted } from '../types.ts'

export function DataPort() {
  const { data, replaceAll, eraseAll } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Persisted | null>(null)
  const [confirmErase, setConfirmErase] = useState(false)

  useEffect(() => {
    document.title = 'Data · Pinfall'
  }, [])

  function exportFile() {
    const blob = new Blob([serializeExport(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const day = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `pinfall-${day}.json`
    link.click()
    URL.revokeObjectURL(url)
    setError(null)
    setMessage('Backup downloaded. It includes pins, edits, rounds, and settings.')
  }

  return (
    <div className="page">
      <TopBar title="Data" backTo="/" />
      <OfflineBanner />
      <main className="wrap stack">
        <p>
          Everything Pinfall knows lives in this browser: IndexedDB, with a localStorage copy as backup. There is no
          account and no server.
        </p>
        <section className="stack">
          <h2>Backup</h2>
          <Button variant="primary" onClick={exportFile}>
            Export JSON
          </Button>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              void file.text().then((text) => {
                const parsed = parseImport(text)
                if (!parsed.ok) {
                  setMessage(null)
                  setError(parsed.error)
                  return
                }
                setError(null)
                setPending(parsed.data)
              })
            }}
          />
          <Button variant="danger" onClick={() => setConfirmErase(true)}>
            Erase this phone
          </Button>
          {message ? <p className="note">{message}</p> : null}
          {error ? <p className="note warn">{error}</p> : null}
        </section>

        <section className="stack">
          <h2>How a pin is learned</h2>
          <p>
            “I’m at Tee” and “I’m at Basket” watch GPS for {SAMPLE_MIN_MS / 1000}–{SAMPLE_MAX_MS / 1000}{' '}
            seconds. Fixes worse than {MAX_ACCEPT_ACCURACY_M} m are dropped. A visit is saved only when at least{' '}
            {MIN_GOOD_FIXES} fixes agree, as one averaged point.
          </p>
          <p>
            The pin is a weighted average of those visits. A reading that claims to be more precise counts more: weight
            is 1 / accuracy². A pin you drag onto the photo is stored as ±{ROUGH_GUESS_ACCURACY_M} m, so a real visit
            outweighs it.
          </p>
          <p>
            A stored point is left out when it sits more than {OUTLIER_FLOOR_M} m away and more than {OUTLIER_SIGMAS}×
            its own accuracy from the others. If a new visit keeps getting rejected, the basket moved — clear that pin
            and record it again.
          </p>
        </section>

        <section className="stack">
          <h2>Install</h2>
          <p>Geolocation only works on HTTPS, or on localhost. A phone cannot use your computer’s localhost.</p>
          <p>iPhone: open the site in Safari, tap Share, then Add to Home Screen. Launch Pinfall from that icon.</p>
          <p>Android: open the site in Chrome, then Install app or Add to Home screen.</p>
          <p>
            The app shell loads again without a connection after the first visit. Satellite photos are requested live
            from Esri and are not saved for offline use.
          </p>
        </section>

        <section className="stack">
          <h2>Map</h2>
          <p>{ESRI_ATTRIBUTION}</p>
          <p className="muted">Leaflet draws the map. Distances use a haversine on a sphere of radius 6,371,008.8 m.</p>
        </section>
      </main>

      <Dialog open={pending != null} title="Replace data on this phone?" onClose={() => setPending(null)}>
        <div className="stack">
          <p>
            This overwrites {data.points.length} saved readings and {data.rounds.length} rounds with the file. Seeded
            courses stay.
          </p>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!pending) return
                replaceAll(pending)
                setPending(null)
                setError(null)
                setMessage('Imported the backup.')
              }}
            >
              Replace
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={confirmErase} title="Erase saved data?" onClose={() => setConfirmErase(false)}>
        <div className="stack">
          <p>Pins, scorecards, and edits on this phone are deleted. The three courses remain, with empty pins.</p>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setConfirmErase(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                eraseAll()
                setConfirmErase(false)
                setMessage('Erased saved data on this phone.')
                setError(null)
              }}
            >
              Erase
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
