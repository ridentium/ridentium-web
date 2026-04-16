'use client'

import { useState, useMemo } from 'react'
import { CRMContatto, CRMStato } from '@/types'
import { logActivity } from '@/lib/registro'
import {
  Phone, MessageCircle, Mail, Download, Plus, Search,
  UserCircle, X, ChevronDown, Trash2, AlertCircle, Globe,
  Clock, CheckCircle2, Star, UserX, ShieldCheck, ShieldOff, Megaphone, Send,
} from 'lucide-react'

type EmailTemplate = 'box-conferma' | 'benvenuto' | 'personalizzata'

const TEMPLATES: { id: EmailTemplate; label: string; desc: string }[] = [
  { id: 'box-conferma',   label: 'Gift Box — conferma',    desc: 'Conferma ricezione richiesta Gift Box, promessa contatto 24–48 h' },
  { id: 'benvenuto',      label: 'Benvenuto',               desc: 'Email di benvenuto per nuovi pazienti' },
  { id: 'personalizzata', label: 'Messaggio personalizzato', desc: 'Testo libero con firma RIDENTIUM' },
]

function templateDefault(sorgente: string | null): EmailTemplate {
  if (sorgente?.toLowerCase().includes('box')) return 'box-conferma'
  return 'benvenuto'
}

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
  userId: string
  userNome: string
}

type FiltroStato    = CRMStato | 'tutti'
type FiltroMarketing = 'tutti' | 'si' | 'no'

export default function CRMAdmin({ contatti: initialContatti, isAdmin, userId, userNome }: Props) {
  const [contatti, setContatti]           = useState(initialContatti)
  const [filtro, setFiltro]               = useState<FiltroStato>('tutti')
  const [filtroMarketing, setFiltroMarketing] = useState<FiltroMarketing>('tutti')
  const [cerca, setCerca]                 = useState('')
  const [dettaglioId, setDettaglioId]     = useState<string | null>(null)

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

  // Modal invio email
  const [emailModal, setEmailModal]     = useState<CRMContatto | null>(null)
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>('benvenuto')
  const [emailCustomSubject, setEmailCustomSubject] = useState('')
  const [emailCustomBody, setEmailCustomBody]       = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [emailOk, setEmailOk]           = useState(false)

  function apriEmailModal(c: CRMContatto) {
    setEmailModal(c)
    setEmailTemplate(templateDefault(c.sorgente))
    setEmailCustomSubject('')
    setEmailCustomBody('')
    setEmailError(null)
    setEmailOk(false)
  }

  // Filtro contatti
  const filtered = useMemo(() => {
    let list = contatti
    if (filtro !== 'tutti') list = list.filter(c => c.stato === filtro)
    if (filtroMarketing === 'si')  list = list.filter(c => c.consenso_marketing === true)
    if (filtroMarketing === 'no')  list = list.filter(c => !c.consenso_marketing)
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
  }, [contatti, filtro, filtroMarketing, cerca])

  // Conteggio contatti con consenso marketing
  const conMarketing = useMemo(
    () => contatti.filter(c => c.consenso_marketing).length,
    [contatti]
  )

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
      const nome = [contatto.nome, contatto.cognome].filter(Boolean).join(' ') || contatto.email || contatto.telefono || id
      await logActivity(userId, userNome, `CRM: stato aggiornato a "${nuovoStato}"`, nome, 'crm')
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
      const nome = [editModal.nome, editModal.cognome].filter(Boolean).join(' ') || editModal.email || editModal.telefono || editModal.id
      await logActivity(userId, userNome, 'CRM: note aggiornate', nome, 'crm')
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
      const nome = [nuovoForm.nome, nuovoForm.cognome].filter(Boolean).join(' ') || nuovoForm.email || nuovoForm.telefono
      await logActivity(userId, userNome, 'CRM: contatto aggiunto', nome, 'crm')
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
    const contatto = contatti.find(c => c.id === id)
    const res = await fetch(`/api/crm/contatti/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setContatti(prev => prev.filter(c => c.id !== id))
      const nome = contatto ? ([contatto.nome, contatto.cognome].filter(Boolean).join(' ') || contatto.email || contatto.telefono || id) : id
      await logActivity(userId, userNome, 'CRM: contatto eliminato', nome, 'crm')
    }
  }

  // ── Invio email ───────────────────────────────────────────────────────────
  async function inviaEmail() {
    if (!emailModal) return
    setEmailSending(true)
    setEmailError(null)
    setEmailOk(false)

    const res = await fetch('/api/crm/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contattoId: emailModal.id,
        template:   emailTemplate,
        ...(emailCustomSubject ? { customSubject: emailCustomSubject } : {}),
        ...(emailTemplate === 'personalizzata' ? { customBody: emailCustomBody } : {}),
      }),
    })

    if (res.ok) {
      setEmailOk(true)
      const nome = nomeCompleto(emailModal)
      await logActivity(userId, userNome, `CRM: email inviata (${emailTemplate})`, nome, 'crm')
      setTimeout(() => setEmailModal(null), 1800)
    } else {
      const data = await res.json().catch(() => ({}))
      setEmailError(data.error ?? 'Errore durante l\'invio')
    }

    setEmailSending(false)
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
      <div className="flex gap-2 flex-wrap mb-3">
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

      {/* ── Filtro consenso marketing ── */}
      <div className="flex items-center gap-2 flex-wrap mb-5 pb-4 border-b border-obsidian-light/20">
        <span className="text-[10px] text-stone/50 uppercase tracking-widest mr-1">Marketing</span>
        {([
          { id: 'tutti' as FiltroMarketing, label: 'Tutti' },
          { id: 'si'    as FiltroMarketing, label: `Consenso sì (${conMarketing})` },
          { id: 'no'    as FiltroMarketing, label: `Consenso no (${contatti.length - conMarketing})` },
        ] as { id: FiltroMarketing; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFiltroMarketing(f.id)}
            className={`text-xs px-3 py-1 rounded border transition-colors flex items-center gap-1.5 ${
              filtroMarketing === f.id
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                : 'border-obsidian-light/40 text-stone hover:text-cream'
            }`}
          >
            {f.id === 'si'  && <Megaphone size={9} />}
            {f.id === 'no'  && <ShieldOff size={9} />}
            {f.label}
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

                    {/* Badge consensi — sempre visibili */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {/* Privacy */}
                      <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                        c.consenso_privacy
                          ? 'bg-green-900/20 text-green-500/80'
                          : 'bg-red-900/10 text-red-400/70'
                      }`}>
                        <ShieldCheck size={8} />
                        Privacy {c.consenso_privacy ? '✓' : '✗'}
                      </span>
                      {/* Marketing */}
                      <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                        c.consenso_marketing
                          ? 'bg-blue-900/20 text-blue-400/80'
                          : 'bg-obsidian-light/20 text-stone/40'
                      }`}>
                        <Megaphone size={8} />
                        Marketing {c.consenso_marketing ? '✓' : '✗'}
                      </span>
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

                    {/* Badge consensi GDPR */}
                    <div className="flex gap-2 flex-wrap mb-3 pb-3 border-b border-obsidian-light/20">
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
                        c.consenso_privacy
                          ? 'bg-green-900/20 border-green-600/30 text-green-400'
                          : 'bg-red-900/20 border-red-600/30 text-red-400'
                      }`}>
                        {c.consenso_privacy
                          ? <ShieldCheck size={9} />
                          : <ShieldOff size={9} />
                        }
                        Privacy {c.consenso_privacy ? 'accettata' : 'non accettata'}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
                        c.consenso_marketing
                          ? 'bg-blue-900/20 border-blue-500/30 text-blue-400'
                          : 'bg-obsidian-light/30 border-obsidian-light/40 text-stone/50'
                      }`}>
                        <Megaphone size={9} />
                        Marketing {c.consenso_marketing ? 'sì' : 'no'}
                      </span>
                      {c.consenso_versione && (
                        <span className="text-[10px] text-stone/40 self-center">
                          Informativa {c.consenso_versione}
                          {c.consenso_timestamp && ` · ${formatData(c.consenso_timestamp)}`}
                        </span>
                      )}
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
                          onClick={() => apriEmailModal(c)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                     bg-gold/10 border border-gold/30 text-gold
                                     hover:bg-gold/20 transition-colors"
                        >
                          <Send size={11} /> Invia email
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

      {/* ── Modal email ── */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">

            <div className="flex items-center justify-between mb-1">
              <h2 className="text-cream font-medium flex items-center gap-2">
                <Send size={14} className="text-gold" />
                Invia email
              </h2>
              <button onClick={() => setEmailModal(null)} className="text-stone hover:text-cream transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-stone text-xs mb-5">
              A: <span className="text-cream">{emailModal.email}</span>
              {emailModal.nome && <> · {nomeCompleto(emailModal)}</>}
            </p>

            {/* Selezione template */}
            <div className="space-y-2 mb-4">
              <label className="block text-xs text-stone mb-2">Tipo di email</label>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setEmailTemplate(t.id); setEmailError(null) }}
                  className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                    emailTemplate === t.id
                      ? 'border-gold/50 bg-gold/10'
                      : 'border-obsidian-light/40 hover:border-obsidian-light'
                  }`}
                >
                  <p className={`text-xs font-medium ${emailTemplate === t.id ? 'text-gold' : 'text-cream'}`}>{t.label}</p>
                  <p className="text-[11px] text-stone/60 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>

            {/* Oggetto personalizzato (opzionale) */}
            {emailTemplate !== 'personalizzata' && (
              <div className="mb-4">
                <label className="block text-xs text-stone mb-1">Oggetto personalizzato <span className="text-stone/40">(opzionale)</span></label>
                <input
                  value={emailCustomSubject}
                  onChange={e => setEmailCustomSubject(e.target.value)}
                  placeholder="Lascia vuoto per usare l'oggetto predefinito"
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                             px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50 placeholder:text-stone/30"
                />
              </div>
            )}

            {/* Testo libero per template personalizzata */}
            {emailTemplate === 'personalizzata' && (
              <div className="mb-4">
                <label className="block text-xs text-stone mb-1">Messaggio <span className="text-red-400">*</span></label>
                <textarea
                  value={emailCustomBody}
                  onChange={e => setEmailCustomBody(e.target.value)}
                  rows={5}
                  placeholder="Scrivi il messaggio da inviare al paziente…"
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg
                             px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50 placeholder:text-stone/30"
                />
              </div>
            )}

            {emailError && (
              <p className="text-red-400 text-xs mb-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {emailError}
              </p>
            )}
            {emailOk && (
              <p className="text-green-400 text-xs mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> Email inviata con successo
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEmailModal(null)}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={inviaEmail}
                disabled={emailSending || (emailTemplate === 'personalizzata' && !emailCustomBody.trim())}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border
                           border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-40"
              >
                <Send size={11} />
                {emailSending ? 'Invio in corso…' : 'Invia'}
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
