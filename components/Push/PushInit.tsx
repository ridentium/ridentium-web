'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { isPushSupported, subscribeUser, getPermissionStatus } from '@/lib/push'

/**
 * PushInit — monta silenziosamente nel layout, registra il SW,
 * richiede il permesso e salva la subscription nel DB.
 * Su iOS mostra un banner "Aggiungi a Home" se l'app non è installata.
 */
export default function PushInit() {
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  useEffect(() => {
    // Run only once per session
    if (sessionStorage.getItem('push-init')) return
    sessionStorage.setItem('push-init', '1')

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    // iOS needs PWA install for background push
    if (isIOS && !isStandalone) {
      if (!localStorage.getItem('ios-banner-dismissed')) {
        setShowIOSBanner(true)
      }
      return
    }

    if (!isPushSupported()) return

    const permission = getPermissionStatus()
    if (permission === 'denied') return

    // Auto-subscribe (shows native dialog if permission is 'default')
    ;(async () => {
      try {
        await subscribeUser()
      } catch (e) {
        console.warn('[PushInit]', e)
      }
    })()
  }, [])

  if (!showIOSBanner) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-stone/30 bg-cream p-4 shadow-2xl md:left-auto md:right-4 md:max-w-sm"
    >
      <span className="shrink-0 text-2xl" aria-hidden="true">📲</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-obsidian">
          Ricevi notifiche su iPhone
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone">
          Tocca <strong className="text-obsidian/80">Condividi</strong>{' '}
          <span aria-hidden="true">⬆︎</span> poi{' '}
          <strong className="text-obsidian/80">Aggiungi a Home</strong>, quindi
          riapri l&apos;app dal tuo schermo.
        </p>
      </div>
      <button
        onClick={() => {
          setShowIOSBanner(false)
          localStorage.setItem('ios-banner-dismissed', '1')
        }}
        className="shrink-0 rounded p-1 text-stone/50 transition-colors hover:text-obsidian"
        aria-label="Chiudi"
      >
        <X size={16} />
      </button>
    </div>
  )
}
