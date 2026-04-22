'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface Notifica {
  id: string
  tipo: 'magazzino' | 'task' | 'ricorrente' | 'messaggio' | 'crm'
  titolo: string
  corpo?: string | null
  url?: string | null
  letta: boolean
  created_at: string
}

interface NotificheContext {
  list: Notifica[]
  unread: number
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<NotificheContext | null>(null)

const POLL_MS = 60_000

export function NotificheProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Notifica[]>([])
  const [unread, setUnread] = useState(0)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const r = await fetch('/api/notifiche', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      setList(d.notifiche ?? [])
      setUnread(d.unreadCount ?? 0)
    } catch {} finally {
      inFlight.current = false
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (unread === 0) return
    try {
      await fetch('/api/notifiche/leggi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setUnread(0)
      setList(prev => prev.map(n => ({ ...n, letta: true })))
    } catch {}
  }, [unread])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    function start() {
      refresh()
      if (timer) clearInterval(timer)
      timer = setInterval(refresh, POLL_MS)
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null }
    }

    function onVisibility() {
      if (document.hidden) stop()
      else start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  return <Ctx.Provider value={{ list, unread, markAllRead, refresh }}>{children}</Ctx.Provider>
}

export function useNotifiche(): NotificheContext {
  const v = useContext(Ctx)
  if (!v) {
    return { list: [], unread: 0, markAllRead: async () => {}, refresh: async () => {} }
  }
  return v
}
