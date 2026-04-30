'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import {
  isPushSupported,
  getPermissionStatus,
  subscribeUser,
  unsubscribeUser,
  getCurrentSubscription,
} from '@/lib/push'

/**
 * PushSetup — toggle esplicito per le notifiche push.
 * Da usare in pagina impostazioni / profilo utente.
 */
export default function PushSetup() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      if (!isPushSupported()) { setLoading(false); return }
      setSupported(true)
      setPermission(getPermissionStatus())
      const sub = await getCurrentSubscription()
      setSubscribed(!!sub)
      setLoading(false)
    }
    check()
  }, [])

  async function toggle() {
    setLoading(true)
    try {
      if (subscribed) {
        await unsubscribeUser()
        setSubscribed(false)
      } else {
        await subscribeUser()
        const perm = getPermissionStatus()
        setPermission(perm)
        if (perm === 'granted') {
          const sub = await getCurrentSubscription()
          setSubscribed(!!sub)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  const denied = permission === 'denied'

  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <p className="text-sm text-cream font-medium">Notifiche push</p>
        <p className="text-[11px] text-stone/60 mt-0.5">
          {denied
            ? 'Permesso negato — abilitale nelle impostazioni del browser'
            : subscribed
            ? 'Attive — ricevi notifiche per task e adempimenti'
            : 'Disattive — attiva per ricevere avvisi in tempo reale'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading || denied}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ml-4 shrink-0 ${
          subscribed
            ? 'border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20'
            : 'border-gold/30 bg-gold/10 text-gold hover:bg-gold/20'
        }`}
      >
        {loading
          ? <Loader2 size={12} className="animate-spin" />
          : subscribed
          ? <><BellOff size={12} /><span>Disattiva</span></>
          : <><Bell size={12} /><span>Attiva</span></>}
      </button>
    </div>
  )
}
