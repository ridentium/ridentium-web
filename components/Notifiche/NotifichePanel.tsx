'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Bell, X, Package, CheckSquare, RefreshCw, MessageCircle, UserCircle2, ExternalLink,
} from 'lucide-react'
import { useNotifiche } from './NotificheProvider'

const TIPO_META: Record<string, { Icon: React.ElementType; color: string; label: string }> = {
  magazzino:  { Icon: Package,       color: '#B91C1C', label: 'Magazzino' },
  task:       { Icon: CheckSquare,   color: '#665647', label: 'Task' },
  ricorrente: { Icon: RefreshCw,     color: '#2563EB', label: 'Ricorrenti' },
  messaggio:  { Icon: MessageCircle, color: '#7C3AED', label: 'Messaggio' },
  crm:        { Icon: UserCircle2,   color: '#059669', label: 'CRM' },
}

function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string>('')
  useEffect(() => {
    function compute() {
      const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
      if (m < 1) return 'adesso'
      if (m < 60) return m + 'm'
      const h = Math.floor(m / 60)
      if (h < 24) return h + 'h'
      return Math.floor(h / 24) + 'g'
    }
    setLabel(compute())
    const t = setInterval(() => setLabel(compute()), 60_000)
    return () => clearInterval(t)
  }, [iso])
  return <span>{label}</span>
}

/**
 * Drawer/panel della campanella notifiche.
 * Deve essere montato UNA SOLA VOLTA (tipicamente in AdminShell): altrimenti
 * il portal viene creato piu' volte e il contenuto compare duplicato nel DOM.
 */
export default function NotifichePanel({ isAdmin }: { isAdmin: boolean }) {
  const [mounted, setMounted] = useState(false)
  const { list, unread, open, setOpen } = useNotifiche()
  const base = isAdmin ? '/admin' : '/staff'

  useEffect(() => { setMounted(true) }, [])

  // Chiudi con ESC quando aperto
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(61,43,31,0.25)' }}
        />
      )}
      <div
        className="fixed top-0 right-0 h-full flex flex-col z-[61]"
        style={{
          width: 'min(380px, 100vw)',
          background: '#F7F4EF',
          borderLeft: '1px solid #DDD5C8',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
          boxShadow: open ? '-8px 0 32px rgba(61,43,31,0.1)' : 'none',
          pointerEvents: open ? 'auto' : 'none',
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        aria-hidden={!open}
      >
        {/* Header panel */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #DDD5C8' }}
        >
          <div className="flex items-center gap-2">
            <Bell size={14} style={{ color: '#665647' }} />
            <span className="text-sm font-medium tracking-wide" style={{ color: '#3D2B1F' }}>Notifiche</span>
            {unread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C' }}>
                {unread} nuove
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`${base}/notifiche`}
              onClick={() => setOpen(false)}
              className="text-[11px] transition-colors"
              style={{ color: 'rgba(102,86,71,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#665647')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(102,86,71,0.5)')}
            >
              Vedi tutte →
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded transition-colors"
              style={{ color: 'rgba(102,86,71,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#3D2B1F')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(102,86,71,0.5)')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Bell size={28} style={{ color: 'rgba(102,86,71,0.2)' }} />
              <p className="text-sm" style={{ color: 'rgba(102,86,71,0.4)' }}>Nessuna notifica</p>
            </div>
          ) : list.map(n => {
            const meta = TIPO_META[n.tipo] ?? TIPO_META.messaggio
            const Icon = meta.Icon
            const inner = (
              <div
                className="flex gap-3 px-5 py-3.5 w-full"
                style={{ background: n.letta ? 'transparent' : 'rgba(102,86,71,0.04)' }}
              >
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: meta.color + '18', border: '1px solid ' + meta.color + '35' }}
                >
                  <Icon size={13} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-sm leading-snug"
                      style={{ color: n.letta ? 'rgba(102,86,71,0.5)' : '#3D2B1F', fontWeight: n.letta ? 400 : 500 }}
                    >
                      {n.titolo}
                    </p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(102,86,71,0.4)' }}>
                      <TimeAgo iso={n.created_at} />
                    </span>
                  </div>
                  {n.corpo && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(102,86,71,0.55)' }}>
                      {n.corpo}
                    </p>
                  )}
                  {!n.letta && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: meta.color }} />
                  )}
                </div>
              </div>
            )
            return (
              <div
                key={n.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid #E8E2D9' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.025)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {n.url
                  ? <Link href={n.url} onClick={() => setOpen(false)} className="block">{inner}</Link>
                  : inner
                }
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {list.length > 0 && (
          <div
            className="px-5 py-3 flex-shrink-0"
            style={{
              borderTop: '1px solid #DDD5C8',
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            }}
          >
            <Link
              href={`${base}/notifiche`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded transition-colors"
              style={{ background: 'rgba(102,86,71,0.08)', border: '1px solid rgba(102,86,71,0.2)', color: '#665647' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(102,86,71,0.14)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(102,86,71,0.08)' }}
            >
              <ExternalLink size={11} /> Archivio completo
            </Link>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
