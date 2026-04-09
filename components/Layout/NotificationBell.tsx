'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing, Check, X } from 'lucide-react'
import { isPushSupported, getPermissionStatus, subscribeUser, unsubscribeUser, getCurrentSubscription } from '@/lib/push'

interface NotificationBellProps {
  className?: string
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'>('loading')
  const [showTooltip, setShowTooltip] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    const perm = getPermissionStatus()
    if (perm === 'denied') {
      setStatus('denied')
      return
    }
    getCurrentSubscription().then((sub) => {
      setStatus(sub ? 'subscribed' : 'unsubscribed')
    })
  }, [])

  async function handleSubscribe() {
    setSaving(true)
    try {
      const sub = await subscribeUser()
      if (!sub) {
        const perm = getPermissionStatus()
        setStatus(perm === 'denied' ? 'denied' : 'unsubscribed')
        return
      }

      // Save to Supabase via API
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })

      setStatus('subscribed')
      setShowTooltip(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleUnsubscribe() {
    setSaving(true)
    try {
      const sub = await getCurrentSubscription()
      if (sub) {
        await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await unsubscribeUser()
      }
      setStatus('unsubscribed')
      setShowTooltip(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || status === 'unsupported') return null

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors
                   hover:bg-obsidian-light/50"
        title={status === 'subscribed' ? 'Notifiche attive' : 'Attiva notifiche'}
      >
        {status === 'subscribed' ? (
          <BellRing size={14} className="text-gold" />
        ) : status === 'denied' ? (
          <BellOff size={14} className="text-stone/40" />
        ) : (
          <Bell size={14} className="text-stone/60 hover:text-stone" />
        )}
      </button>

      {showTooltip && status !== 'denied' && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowTooltip(false)} />
          {/* Tooltip panel */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                          bg-obsidian-mid border border-obsidian-light rounded-lg shadow-2xl p-4 w-56">
            <div className="flex items-center justify-between mb-2">
              <p className="text-cream text-xs font-medium">Notifiche push</p>
              <button onClick={() => setShowTooltip(false)} className="text-stone/50 hover:text-stone">
                <X size={12} />
              </button>
            </div>

            {status === 'subscribed' ? (
              <>
                <div className="flex items-center gap-1.5 text-green-400 text-xs mb-3">
                  <Check size={11} /> Notifiche attive su questo dispositivo
                </div>
                <button
                  onClick={handleUnsubscribe}
                  disabled={saving}
                  className="w-full text-xs py-1.5 px-3 rounded border border-obsidian-light
                             text-stone/70 hover:text-red-400 hover:border-red-400/30 transition-colors
                             disabled:opacity-50"
                >
                  {saving ? 'Disattivazione…' : 'Disattiva su questo dispositivo'}
                </button>
              </>
            ) : (
              <>
                <p className="text-stone text-xs mb-3">
                  Ricevi notifiche per scorte, task e azioni ricorrenti.
                </p>
                <button
                  onClick={handleSubscribe}
                  disabled={saving}
                  className="w-full text-xs py-1.5 px-3 rounded bg-gold/20 border border-gold/30
                             text-gold hover:bg-gold/30 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Attivazione…' : 'Attiva notifiche'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {status === 'denied' && showTooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowTooltip(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                          bg-obsidian-mid border border-obsidian-light rounded-lg shadow-2xl p-4 w-56">
            <p className="text-stone text-xs">
              Le notifiche sono bloccate nel browser. Vai nelle impostazioni del browser per riabilitarle.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
