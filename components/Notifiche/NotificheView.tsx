'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell, Package, CheckSquare, RefreshCw, MessageCircle, UserCircle2,
  CheckCheck, Send,
} from 'lucide-react'

import type { Notifica } from '@/types'

const TIPO_META = {
  magazzino:  { Icon: Package,       color: '#B91C1C', label: 'Magazzino' },
  task:       { Icon: CheckSquare,   color: '#665647', label: 'Task' },
  ricorrente: { Icon: RefreshCw,     color: '#2563EB', label: 'Ricorrenti' },
  messaggio:  { Icon: MessageCircle, color: '#7C3AED', label: 'Messaggi' },
  crm:        { Icon: UserCircle2,   color: '#059669', label: 'CRM' },
} as const

function fmt(d: string) {
  return new Date(d).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

type FiltroLetta = 'tutte' | 'nonlette' | 'lette'

export default function NotificheView({ isAdmin }: { isAdmin: boolean }) {
  const [notifiche, setNotifiche] = useState<Notifica[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtroTipo, setFiltroTipo]   = useState('tutti')
  const [filtroLetta, setFiltroLetta] = useState<FiltroLetta>('tutte')

  const [msgTitolo, setMsgTitolo] = useState('')
  const [msgCorpo,  setMsgCorpo]  = useState('')
  const [msgDest,   setMsgDest]   = useState<'tutti' | 'staff' | 'admin'>('tutti')
  const [sending,   setSending]   = useState(false)
  const [msgOk,     setMsgOk]     = useState('')

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/notifiche?limit=100', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      setNotifiche(d.notifiche ?? [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function markAllRead() {
    await fetch('/api/notifiche/leggi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifiche(p => p.map(n => ({ ...n, letta: true })))
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!msgTitolo.trim()) return
    setSending(true)
    try {
      await fetch('/api/notifiche/invia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titolo: msgTitolo, corpo: msgCorpo, destinatari: msgDest }),
      })
      setMsgOk('Messaggio inviato con successo')
      setMsgTitolo(''); setMsgCorpo('')
      setTimeout(() => setMsgOk(''), 3500)
      fetchData()
    } finally { setSending(false) }
  }

  const filtered = notifiche.filter(n => {
    if (filtroTipo !== 'tutti' && n.tipo !== filtroTipo) return false
    if (filtroLetta === 'nonlette' && n.letta) return false
    if (filtroLetta === 'lette' && !n.letta) return false
    return true
  })

  const unread = notifiche.filter(n => !n.letta).length
  const chipBase  = { borderRadius: 20, fontSize: 12, padding: '6px 14px', transition: 'all .15s', border: '1px solid' }
  const chipActive  = { ...chipBase, background: 'rgba(102,86,71,0.12)', borderColor: 'rgba(102,86,71,0.4)', color: '#665647' }
  const chipInactive = { ...chipBase, background: 'rgba(61,43,31,0.04)', borderColor: 'rgba(61,43,31,0.15)', color: 'rgba(102,86,71,0.55)' }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-light tracking-wide"
            style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', color: '#3D2B1F' }}
          >
            Notifiche
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(102,86,71,0.5)' }}>
            {unread > 0 ? `${unread} non ${unread === 1 ? 'letta' : 'lette'}` : 'Tutte lette'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded transition-colors"
            style={{ background: 'rgba(102,86,71,0.08)', border: '1px solid rgba(102,86,71,0.25)', color: '#665647' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(102,86,71,0.14)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(102,86,71,0.08)' }}
          >
            <CheckCheck size={14} /> Segna tutte lette
          </button>
        )}
      </div>

      {/* Form invio (solo admin) */}
      {isAdmin && (
        <div className="rounded-lg p-5" style={{ background: '#EDE9E2', border: '1px solid #DDD5C8' }}>
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={14} style={{ color: '#7C3AED' }} />
            <h2 className="text-sm font-medium tracking-wide" style={{ color: '#3D2B1F' }}>
              Invia messaggio al team
            </h2>
          </div>
          <form onSubmit={handleSend} className="space-y-3">
            <input
              value={msgTitolo} onChange={e => setMsgTitolo(e.target.value)}
              placeholder="Titolo"
              className="input"
            />
            <textarea
              value={msgCorpo} onChange={e => setMsgCorpo(e.target.value)}
              placeholder="Testo del messaggio (opzionale)"
              rows={2}
              className="input resize-none"
            />
            <div className="flex items-center gap-3">
              <select
                value={msgDest} onChange={e => setMsgDest(e.target.value as any)}
                className="input flex-1"
              >
                <option value="tutti">Tutto il team</option>
                <option value="staff">Solo staff</option>
                <option value="admin">Solo admin</option>
              </select>
              <button
                type="submit" disabled={sending || !msgTitolo.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', color: '#7C3AED' }}
              >
                <Send size={13} /> {sending ? 'Invio…' : 'Invia'}
              </button>
            </div>
            {msgOk && <p className="text-xs" style={{ color: '#15803D' }}>{msgOk}</p>}
          </form>
        </div>
      )}

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        {(['tutte', 'nonlette', 'lette'] as FiltroLetta[]).map(f => (
          <button key={f} onClick={() => setFiltroLetta(f)}
            style={filtroLetta === f ? chipActive : chipInactive}>
            {{ tutte: 'Tutte', nonlette: 'Non lette', lette: 'Lette' }[f]}
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: '#DDD5C8', display: 'inline-block', margin: '0 4px' }} />
        {(['tutti', ...Object.keys(TIPO_META)] as string[]).map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            style={filtroTipo === t ? chipActive : chipInactive}>
            {t === 'tutti' ? 'Tutte le categorie' : TIPO_META[t as keyof typeof TIPO_META].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(102,86,71,0.15)', borderTopColor: '#665647' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Bell size={32} style={{ color: 'rgba(102,86,71,0.2)' }} />
          <p style={{ color: 'rgba(102,86,71,0.4)' }}>Nessuna notifica</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #DDD5C8' }}>
          {filtered.map((n, i) => {
            const meta = TIPO_META[n.tipo] ?? TIPO_META.messaggio
            const Icon = meta.Icon
            return (
              <div
                key={n.id}
                style={{
                  background: n.letta
                    ? (i % 2 === 0 ? '#FDFCFA' : '#F7F4EF')
                    : 'rgba(102,86,71,0.05)',
                  borderBottom: i < filtered.length - 1 ? '1px solid #E8E2D9' : 'none',
                }}
              >
                <div className="flex gap-4 px-5 py-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: meta.color + '18', border: '1px solid ' + meta.color + '30' }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {!n.letta && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: meta.color }} />
                        )}
                        <p
                          className="text-sm leading-snug"
                          style={{ color: n.letta ? 'rgba(102,86,71,0.5)' : '#3D2B1F', fontWeight: n.letta ? 400 : 500 }}
                        >
                          {n.titolo}
                        </p>
                      </div>
                      <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: 'rgba(102,86,71,0.4)' }}>
                        {fmt(n.created_at)}
                      </span>
                    </div>
                    {n.corpo && (
                      <p className="text-xs mt-1" style={{ color: 'rgba(102,86,71,0.55)' }}>{n.corpo}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-sm"
                        style={{ background: meta.color + '15', color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {n.url && (
                        <Link
                          href={n.url}
                          className="text-xs transition-colors"
                          style={{ color: 'rgba(102,86,71,0.45)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#665647')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(102,86,71,0.45)')}
                        >
                          Vai →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
