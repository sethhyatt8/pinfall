import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useStore } from '../context/store-context.ts'
import { formatAccuracy } from '../lib/geo.ts'

export function Splash() {
  return (
    <div className="splash">
      <Mark />
      <p className="brand">
        Pin<span>fall</span>
      </p>
      <p className="muted">Loading pins saved on this phone…</p>
    </div>
  )
}

export function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      <path d="M16 2.5v4.5M16 25v4.5M2.5 16h4.5M25 16h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function TopBar({ title, backTo, extra }: { title: string; backTo?: string; extra?: ReactNode }) {
  return (
    <header className="topbar">
      {backTo ? (
        <Link to={backTo} className="icon-btn" aria-label="Back">
          ‹
        </Link>
      ) : (
        <Mark />
      )}
      <h1>{title}</h1>
      {extra}
      <UnitToggle />
    </header>
  )
}

export function UnitToggle() {
  const { data, setUnits } = useStore()
  return (
    <div className="unit-toggle" role="group" aria-label="Distance units">
      <button type="button" aria-pressed={data.settings.units === 'ft'} onClick={() => setUnits('ft')}>
        ft
      </button>
      <button type="button" aria-pressed={data.settings.units === 'm'} onClick={() => setUnits('m')}>
        m
      </button>
    </div>
  )
}

export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  if (online) return null
  return (
    <p className="offline">
      You’re offline. Saved pins, distances, and the scorecard still work. The satellite photo needs a connection.
    </p>
  )
}

export function Missing({ message }: { message: string }) {
  return (
    <div className="page">
      <TopBar title="Pinfall" backTo="/" />
      <div className="wrap stack">
        <p>{message}</p>
        <Link className="btn btn-primary" to="/">
          All courses
        </Link>
      </div>
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallHint() {
  const { data, dismissInstallHint } = useStore()
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const nav = navigator as Navigator & { standalone?: boolean }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (standalone || data.settings.installHintDismissed) return null
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <section className="note stack">
      <p>
        <strong>Add Pinfall to your home screen.</strong> GPS works after the first HTTPS load, including offline.
      </p>
      {ios ? (
        <p>In Safari: Share, then Add to Home Screen. Open it from the icon next time.</p>
      ) : (
        <p>In Chrome: menu, then Install app or Add to Home screen.</p>
      )}
      <div className="link-row">
        {promptEvent ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void promptEvent.prompt()
              void promptEvent.userChoice.then(() => setPromptEvent(null))
            }}
          >
            Install
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={dismissInstallHint}>
          Not now
        </button>
      </div>
    </section>
  )
}

export function GpsPill({
  accuracyM,
  ageSec,
  error,
}: {
  accuracyM: number | null
  ageSec: number | null
  error: string | null
}) {
  const { data } = useStore()
  if (accuracyM == null || !Number.isFinite(accuracyM)) {
    return (
      <p className="pill bad">
        <i />
        {error ?? 'Waiting for GPS'}
      </p>
    )
  }
  const tone = accuracyM <= 6 ? 'good' : accuracyM <= 15 ? 'ok' : 'bad'
  const stale = ageSec != null && ageSec > 8
  return (
    <p className={`pill ${stale ? 'ok' : tone}`}>
      <i />
      GPS {formatAccuracy(accuracyM, data.settings.units)}
      {stale ? ` · ${ageSec}s ago` : ''}
    </p>
  )
}
