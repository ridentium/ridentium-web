'use client'

import { useState, useMemo } from 'react'
import { CRMContatto, CRMStato } from '@/types'
import {
  Phone, MessageCircle, Mail, Download, Plus, Search,
  UserCircle, X, ChevronDown, Trash2, AlertCircle, Globe,
  Clock, CheckCircle2, Star, UserX, UserCheck,
} from 'lucide-react'

// ─── Configurazione stati ─────────────────────────────────────────────────────

const STATI: { id: CRMStato; label: string; color: string; bg: string; icon: React.ElementType }[] = [
  { id: 'nuovo',       label: 'Nuovo',        color: 'text-gold',       bg: 'bg-gold/10 border-gold/30',         icon: Clock },
  { id: 'contattato',  label: 'Contattato',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30', icon: Phone },
  { id: 'appuntamento',label: 'Appuntamento', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30', icon: CheckCircle2 },
  { id: 'cliente',     label: 'Cliente',      color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',   icon: Star },
  { id: 'perso',       label: 'Perso',        color: 'text-stone',      bg: 'bg-stone/10 border-stone/30',        icon: UserX },
]

const statoInfo = (stato: CRMStato) => STATI.find(s => s.id === stato) ?? STATI[0]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nomeCompleto(c: CRMContatto) {
  const parts = [c.nome, c.cognome].filter(Boolean).join(' ')
  return parts || '—'
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function iniziali(c: CRMContatto) {
  const n = c.nome?.[0] ?? ''
  const cg = c.cognome?.[0] ?? ''
  return (n + cg).toUpperCase() || (c.email?.[0]?.toUpperCase() ?? '?')
}

// ─── Componente principale ────────────────────────────────────────────────────

interface Props {
  contatti: CRMContatto[]
  isAdmin: boolean
}

type FiltroStato = CRMStato | 'tutti'

export default function CRMAdmin({ contatti: initialContatti, isAdmin }: Props) {
  const [contatti, setContatti]     = useState(initialContatti)
  const [filtro, setFiltro]         = useState<FiltroStato>('tutti')
  const [cerca, setCerca]           = useState('')
  const [dettaglioId, setDettaglioId] = useState<string | null>(null)

  // Modal aggiunta manuale
  const [nuovoModal, setNuovoModal] = useState(false)
  const [nuovoForm, setNuovoForm]   = useState({ nome: '', cognome: '', email: '', telefono: '', sorgente: '', note: '' })
  const [nuovoSaving, setNuovoSaving] = useState(false)
  const [nuovoError, setNuovoError]   = useState<string | null>(null)

  // Modal modifica note / stato inline
  const [editModal, setEditModal] = useState<CRMContatto | null>(null)
  const [editNote, setEditNote]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Stato per cambio stato rapido
  const [statoLoading, setStatoLoading] = useState<string | null>(null)

  // Filtro contatti
  const filtered = useMemo(() => {
    let list = contatti
    if (filtro !== 'tutti') list = list.filter(c => c.stato === filtro)
    if (cerca.trim()) {
      const q = cerca.toLowerCase()
      list = list.filter(c =>
        (c.nome ?? '').toLowerCase().includes(q) ||
        (c.cognome ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.telefono ?? '').includes(q) ||
        (c.sorgente ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [contatti, filtro, cerca])

  const counts = useMemo(() => {
    const m: Record<string, number> = { tutti: contatti.length }
    for (const s of STATI) m[s.id] = contatti.filter(c => c.stato === s.id).length
    return m
  }, [contatti])

  // ── Cambio stato rapido ────────────────────────────────────────────────────
  async function cambiaStato(id: string, nuovoStato: CRMStato) {
    setStatoLoading(id)
    const res = await fetch(`/api/crm/contatti/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: nuovoStato }),
    })
    if (res.ok) {
      const { contatto } = await res.json()
      setContatti(prev => prev.map(c => c.id === id ? contatto : c))
    }
    setStatoLoading(null)
  }

  // ── Aggiornamento note ─────────────────────────────────────────────────────
  async function salvaNote() {
    if (!editModal) return
    setEditSaving(true)
    const res = await fetch(`/api/crm/contatti/${editModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: editNote }),
    })
    if (res.ok) {
      const { contatto } = await res.json()
      setContatti(prev => prev.map(c => c.id === editModal.id ? contatto : c))
      setEditModal(null)
    }
    setEditSaving(false)
  }

  // ── Aggiunta manuale ───────────────────────────────────────────────────────
  async function creaNuovoContatto() {
    if (!nuovoForm.email.trim() && !nuovoForm.telefono.trim()) {
      setNuovoError('Inserisci almeno email o telefono')
      return
    }
    setNuovoSaving(true)
    setNuovoError(null)
    const res = await fetch('/api/crm/contatti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuovoForm, sorgente: nuovoForm.sorgente || 'manuale' }),
    })
    if (res.ok) {
      const { id } = await res.json()
      const nuovoContatto: CRMContatto = {
        id,
        ...nuovoForm,
        nome:     nuovoForm.nome     || null,
        cognome:  nuovoForm.cognome  || null,
        email:    nuovoForm.email    || null,
        telefono: nuovoForm.telefono || null,
        note:     nuovoForm.note     || null,
        sorgente: nuovoForm.sorgente || 'manuale',
        stato:    'nuovo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setContatti(prev => [nuovoContatto, ...prev])
      setNuovoModal(false)
      setNuovoForm({ nome: '', cognome: '', email: '', telefono: '', sorgente: '', note: '' })
    } else {
      const body = await res.json().catch(() => ({}))
      setNuovoError(body.error ?? 'Errore nel salvataggio')
    }
    setNuovoSaving(false)
  }

  // ── Elimina contatto ───────────────────────────────────────────────────────
  async function eliminaContatto(id: string) {
    if (!confirm('Eliminare questo contatto? L\'azione non è reversibile.')) return
    const res = await fetch(`/api/crm/contatti/${id}`, { method: 'DELETE' })
    if (res.ok) setContatti(prev => prev.filter(c => c.id !== id))
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const url = filtro !== 'tutti'
      ? `/api/crm/contatti?format=csv&stato=${filtro}`
      : '/api/crm/contatti?format=csv'
    window.open(url, '_blank')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const dettaglio = dettaglioId ? contatti.find(c => c.id === dettaglioId) : null

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Cerca */}
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone/50" />
          <input
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="Cerca per nome, email, telefono…"
            className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                       pl-8 pr-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50 placeholder:text-stone/40"
          />
        </div>
        {/* Azioni */}
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded border
                       border-obsidian-light/60 text-stone hover:text-cream transition-colors"
          >
            <Download size={13} /> Esporta CSV
          </button>
          <button
            onClick={() => { setNuovoModal(true); setNuovoError(null) }}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border
                       border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
          >
            <Plus size={13} /> Aggiungi
          </button>
        </div>
      </div>

      {/* ── Filtri stato ── */}
      <div className="flex gap-2 flex-wrap mb-5">
        {[{ id: 'tutti' as FiltroStato, label: 'Tutti' }, ...STATI.map(s => ({ id: s.id as FiltroStato, label: s.label }))].map(t => (
          <button
            key={t.id}
            onClick={() => setFiltro(t.id)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              filtro === t.id
                ? 'bg-gold/20 border-gold/40 text-gold'
                : 'border-obsidian-light/40 text-stone hover:text-cream'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              filtro === t.id ? 'bg-gold/30' : 'bg-obsidian-light/40'
            }`}>
              {counts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── Lista contatti ── */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <UserCircle size={32} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">
            {cerca ? 'Nessun risultato per questa ricerca' : 'Nessun contatto trovato'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const si = statoInfo(c.stato)
            const StatoIcon = si.icon
            const isExpanded = dettaglioId === c.id

            return (
              <div key={c.id} className="card">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-obsidian-light border border-obsidian-light/60
                                  flex items-center justify-center text-stone text-sm font-medium flex-shrink-0">
                    {iniziali(c)}
                  </div>

                  {/* Info principali */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-cream">{nomeCompleto(c)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${si.bg} ${si.color}`}>
                        <StatoIcon size={9} />
                        {si.label}
                      </span>
                      {c.sorgente && (
                        <span className="text-[10px] px-2 py-0.5 rounded border border-obsidian-light/30 text-stone flex items-center gap-1">
                          <Globe size={9} /> {c.sorgente}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.email    && <span className="text-xs text-stone/70">{c.email}</span>}
                      {c.telefono && <span className="text-xs text-stone/70">{c.telefono}</span>}
                      <span className="text-[10px] text-stone/40">{formatData(c.created_at)}</span>
                    </div>
                    {c.note && isExpanded && (
                      <p className="text-xs text-stone/70 mt-1.5 italic">"{c.note}"</p>
                    )}
                  </div>

                  {/* Toggle dettaglio */}
                  <button
                    onClick={() => setDettaglioId(isExpanded ? null : c.id)}
                    className="text-stone hover:text-cream transition-colors p-1 flex-shrink-0"
                  >
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Azioni espanse */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-obsidian-light/30">
                    {/* Cambio stato */}
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {STATI.map(s => (
                        <button
                          key={s.id}
                          onClick={() => cambiaStato(c.id, s.id)}
                          disabled={c.stato === s.id || statoLoading === c.id}
                          className={`text-[10px] px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${
                            c.stato === s.id
                              ? `${s.bg} ${s.color} font-semibold`
                              : 'border-obsidian-light/40 text-stone hover:text-cream disabled:opacity-40'
                          }`}
                        >
                          <s.icon size={9} />
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Azioni contatto */}
                    <div className="flex gap-2 flex-wrap">
                      {c.telefono && (
                        <a
                          href={`tel:${c.telefono.replace(/\s/g, '')}`}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                     bg-violet-500/10 border border-violet-500/30 text-violet-400
                                     hover:bg-violet-500/20 transition-colors"
                        >
                          <Phone size={11} /> Chiama
                        </a>
                      )}
                      {c.telefono && (
                        <button
                          onClick={() => {
                            const phone = c.telefono!.replace(/\D/g, '')
                            window.open(`https://wa.me/${phone}`, '_blank')
                          }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                     bg-green-900/30 border border-green-600/30 text-green-400
                                     hover:bg-green-900/50 transition-colors"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                      )}
                      {c.email && (
                        <button
                          onClick={() => window.open(`mailto:${c.email}`)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                     bg-gold/10 border border-gold/30 text-gold
                                     hover:bg-gold/20 transition-colors"
                        >
                          <Mail size={11} /> Email
                        </button>
                      )}
                      <button
                        onClick={() => { setEditModal(c); setEditNote(c.note ?? '') }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                   bg-obsidian-light/40 border border-obsidian-light/60 text-stone
                                   hover:text-cream transition-colors"
                      >
                        Note {c.note ? '✎' : '+'}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => eliminaContatto(c.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                     bg-red-500/10 border border-red-500/30 text-red-400
                                     hover:bg-red-500/20 transition-colors ml-auto"
                        >
                          <Trash2 size={11} /> Elimina
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal aggiunta manuale ── */}
      {nuovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-cream font-medium">Nuovo contatto</h2>
              <button onClick={() => setNuovoModal(false)} className="text-stone hover:text-cream transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone mb-1">Nome</label>
                  <input
                    value={nuovoForm.nome}
                    onChange={e => setNuovoForm(p => ({ ...p, nome: e.target.value }))}
                    className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                               px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50"
                    placeholder="Mario"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone mb-1">Cognome</label>
                  <input
                    value={nuovoForm.cognome}
                    onChange={e => setNuovoForm(p => ({ ...p, cognome: e.target.value }))}
                    className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                               px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50"
                    placeholder="Rossi"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Email</label>
                <input
                  type="email"
                  value={nuovoForm.email}
                  onChange={e => setNuovoForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                             px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50"
                  placeholder="mario@esempio.com"
                />
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Telefono</label>
                <input
                  type="tel"
                  value={nuovoForm.telefono}
                  onChange={e => setNuovoForm(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                             px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50"
                  placeholder="+39 340 000 0000"
                />
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Sorgente</label>
                <input
                  value={nuovoForm.sorgente}
                  onChange={e => setNuovoForm(p => ({ ...p, sorgente: e.target.value }))}
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                             px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50"
                  placeholder="Es. landing-implanti, referral…"
                />
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Note</label>
                <textarea
                  value={nuovoForm.note}
                  onChange={e => setNuovoForm(p => ({ ...p, note: e.target.value }))}
                  rows={2}
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                             px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50"
                  placeholder="Informazioni aggiuntive…"
                />
              </div>
            </div>

            {nuovoError && (
              <p className="text-red-400 text-xs mt-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {nuovoError}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setNuovoModal(false)}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={creaNuovoContatto}
                disabled={nuovoSaving}
                className="text-xs px-4 py-2 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
              >
                {nuovoSaving ? 'Salvataggio…' : 'Aggiungi contatto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal note ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h2 className="text-cream font-medium mb-1">Note — {nomeCompleto(editModal)}</h2>
            <p className="text-stone text-xs mb-4">Aggiungi o modifica le note per questo contatto</p>
            <textarea
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              rows={4}
              autoFocus
              className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                         px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50 mb-4"
              placeholder="Inserisci note…"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditModal(null)}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={salvaNote}
                disabled={editSaving}
                className="text-xs px-4 py-2 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
              >
                {editSaving ? 'Salvataggio…' : 'Salva note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
