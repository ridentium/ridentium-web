'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Bell, X, Package, CheckSquare, RefreshCw, MessageCircle, UserCircle2, ExternalLink,
} from 'lucide-react'
import { useNotifiche } from './NotificheProvider'

const TIPO_META: Record<string, { Icon: React.ElementType; color: string; label: string }> = {
  magazzino:  { Icon: Package,       color: '#F87171', label: 'Magazzino' },
  task:       { Icon: CheckSquare,   color: '#C9A84C', label: 'Task' },
  ricorrente: { Icon: RefreshCw,     color: '#60A5FA', label: 'Ricorrenti' },
  messaggio:  { Icon: MessageCircle, color: '#A78BFA', label: 'Messaggio' },
  crm:        { Icon: UserCircle2,   color: '#34D399', label: 'CRM' },
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

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.45)' }}
        />
      )}
      <div
        className="fixed top-0 right-0 h-full flex flex-col z-[61]"
        style={{
          width: 'min(380px, 100vw)',
          background: '#1A1009',
          borderLeft: '1px solid rgba(74,59,44,0.6)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
          boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.45)' : 'none',
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        {/* Header panel */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(74,59,44,0.5)' }}
        >
          <div className="flex items-center gap-2">
            <Bell size={14} style={{ color: '#C9A84C' }} />
            <span className="text-sm font-medium tracking-wide" style={{ color: '#F2EDE4' }}>Notifiche</span>
            {unread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(224,85,69,0.2)', color: '#F87171' }}>
                {unread} nuove
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`${base}/notifiche`}
              onClick={() => setOpen(false)}
              className="text-[11px] transition-colors"
              style={{ color: 'rgba(160,144,126,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(160,144,126,0.6)')}
            >
              Vedi tutte →
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded transition-colors"
              style={{ color: 'rgba(160,144,126,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F2EDE4')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(160,144,126,0.5)')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Bell size={28} style={{ color: 'rgba(160,144,126,0.25)' }} />
              <p className="text-sm" style={{ color: 'rgba(160,144,126,0.45)' }}>Nessuna notifica</p>
            </div>
          ) : list.map(n => {
            const meta = TIPO_META[n.tipo] ?? TIPO_META.messaggio
            const Icon = meta.Icon
            const inner = (
              <div
                className="flex gap-3 px-5 py-3.5 w-full"
                style={{ background: n.letta ? 'transparent' : 'rgba(201,168,76,0.04)' }}
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
                      style={{ color: n.letta ? 'rgba(210,198,182,0.65)' : '#F2EDE4', fontWeight: n.letta ? 400 : 500 }}
                    >
                      {n.titolo}
                    </p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(160,144,126,0.45)' }}>
                      <TimeAgo iso={n.created_at} />
                    </span>
                  </div>
                  {n.corpo && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(160,144,126,0.65)' }}>
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
                className="transition-colors hover:bg-white/[0.025]"
                style={{ borderBottom: '1px solid rgba(74,59,44,0.25)' }}
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
          <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(74,59,44,0.35)' }}>
            <Link
              href={`${base}/notifiche`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded transition-colors"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(201,168,76,0.14)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(201,168,76,0.08)' }}
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
