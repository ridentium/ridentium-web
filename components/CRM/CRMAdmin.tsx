'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { CRMContatto, CRMStato, CrmInterazione, CrmInterazioneTipo } from '@/types'
import {
  Phone, MessageCircle, Mail, Download, Plus, Search,
  UserCircle, X, ChevronDown, Trash2, AlertCircle, Globe,
  Clock, CheckCircle2, Star, UserX, ShieldCheck, ShieldOff, Megaphone, Send,
  ChevronLeft, ChevronRight, FileText, CalendarCheck, History, ArrowRight,
} from 'lucide-react'

const PER_PAGINA = 20

// Sorgenti predefinite — possono essere estese senza migrazione DB (campo TEXT libero nel DB)
const SORGENTI = [
  { value: '',                label: '— Seleziona sorgente —' },
  { value: 'manuale',         label: 'Manuale (staff)' },
  { value: 'landing-implanti',label: 'Landing — Implanti' },
  { value: 'landing-box',     label: 'Landing — Gift Box' },
  { value: 'instagram',       label: 'Instagram' },
  { value: 'facebook',        label: 'Facebook' },
  { value: 'google',          label: 'Google Ads' },
  { value: 'referral',        label: 'Passaparola' },
  { value: 'whatsapp',        label: 'WhatsApp diretto' },
  { value: 'telefono',        label: 'Telefonata diretta' },
  { value: 'altro',           label: 'Altro' },
] as const

type EmailTemplate = 'box-conferma' | 'benvenuto' | 'personalizzata' | 'ricorda-appuntamento'

const TEMPLATES: { id: EmailTemplate; label: string; desc: string }[] = [
  { id: 'box-conferma',   label: 'Gift Box — conferma',    desc: 'Conferma ricezione richiesta Gift Box, promessa contatto 24–48 h' },
  { id: 'benvenuto',      label: 'Benvenuto',               desc: 'Email di benvenuto per nuovi pazienti' },
  { id: 'personalizzata', label: 'Messaggio personalizzato', desc: 'Testo libero con firma RIDENTIUM' },
  { id: 'ricorda-appuntamento', label: 'Ricorda appuntamento',     desc: 'Promemoria personalizzato per il prossimo appuntamento' },
]

function templateDefault(sorgente: string | null): EmailTemplate {
  if (sorgente?.toLowerCase().includes('box')) return 'box-conferma'
  return 'benvenuto'
}

// ─── Configurazione stati ────────────────────────────────────────────────────

const STATI: { id: CRMStato; label: string; color: string; bg: string; icon: React.ElementType }[] = [
  { id: 'nuovo',       label: 'Nuovo',        color: 'text-gold',       bg: 'bg-gold/10 border-gold/30',         icon: Clock },
  { id: 'contattato',  label: 'Contattato',   color: 'text-blue-600',   bg: 'bg-blue-500/10 border-blue-500/30', icon: Phone },
  { id: 'appuntamento',label: 'Appuntamento', color: 'text-violet-600', bg: 'bg-violet-500/10 border-violet-500/30', icon: CheckCircle2 },
  { id: 'cliente',     label: 'Cliente',      color: 'text-green-700',  bg: 'bg-green-500/10 border-green-500/30',   icon: Star },
  { id: 'perso',       label: 'Perso',        color: 'text-stone',      bg: 'bg-stone/10 border-stone/30',        icon: UserX },
]

const statoInfo = (stato: CRMStato) => STATI.find(s => s.id === stato) ?? STATI[0]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nomeCompleto(c: CRMContatto) {
  const parts = [c.nome, c.cognome].filter(Boolean).join(' ')
  return parts || '—'
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Quanti giorni fa è avvenuta l'ultima modifica al contatto. */
function formatGiorniAggiornato(iso: string): string {
  const giorni = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (giorni === 0) return 'aggiornato oggi'
  if (giorni === 1) return 'aggiornato ieri'
  return `aggiornato ${giorni} gg fa`
}

/** Restituisce la label leggibile della sorgente, o il valore raw se sconosciuto. */
function labelSorgente(value: string | null): string {
  if (!value) return ''
  return SORGENTI.find(s => s.value === value)?.label ?? value
}

function iniziali(c: CRMContatto) {
  const n = c.nome?.[0] ?? ''
  const cg = c.cognome?.[0] ?? ''
  return (n + cg).toUpperCase() || (c.email?.[0]?.toUpperCase() ?? '?')
}

// ─── Interazioni — config ────────────────────────────────────────────────────

const TIPI_INTERAZIONE: CrmInterazioneTipo[] = ['chiamata', 'email', 'whatsapp', 'nota', 'appuntamento']

const TIPO_ICON: Record<CrmInterazioneTipo, React.ElementType> = {
  chiamata:     Phone,
  email:        Mail,
  whatsapp:     MessageCircle,
  nota:         FileText,
  appuntamento: CalendarCheck,
}

const TIPO_LABEL: Record<CrmInterazioneTipo, string> = {
  chiamata:     'Chiamata',
  email:        'Email',
  whatsapp:     'WhatsApp',
  nota:         'Nota',
  appuntamento: 'Appuntamento',
}

function TipoIcon({ tipo, size = 12, className = '' }: { tipo: CrmInterazioneTipo; size?: number; className?: string }) {
  const Icon = TIPO_ICON[tipo]
  return <Icon size={size} className={className} />
}

function formatDataBreve(iso: string) {
  // Accetta sia "YYYY-MM-DD" che ISO full
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Componente principale ───────────────────────────────────────────────────

interface Props {
  contatti: CRMContatto[]
  isAdmin: boolean
}

type FiltroStato    = CRMStato | 'tutti'
type FiltroMarketing = 'tutti' | 'si' | 'no'
type FiltroFollowUp = 'nessuno' | 'oggi' | 'settimana' | 'scaduti'

export default function CRMAdmin({ contatti: initialContatti, isAdmin }: Props) {
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

  // Modal task di follow-up
  const [taskModal, setTaskModal]     = useState<CRMContatto | null>(null)
  const [taskScadenza, setTaskScadenza] = useState('')
  const [taskNota, setTaskNota]       = useState('')
  const [taskSaving, setTaskSaving]   = useState(false)
  const [taskOk, setTaskOk]           = useState(false)
  const [taskError, setTaskError]     = useState<string | null>(null)

  function apriTaskModal(c: CRMContatto) {
    setTaskModal(c)
    // Default: domani
    const domani = new Date(); domani.setDate(domani.getDate() + 1)
    setTaskScadenza(domani.toISOString().slice(0, 10))
    setTaskNota('')
    setTaskOk(false)
    setTaskError(null)
  }

  async function creaTaskFollowUp() {
    if (!taskModal || taskSaving) return
    setTaskSaving(true)
    setTaskError(null)
    const nomeLead = nomeCompleto(taskModal)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titolo: `Follow-up CRM: ${nomeLead}`,
        descrizione: taskNota.trim() || `Contattare il lead ${nomeLead} (${taskModal.email ?? taskModal.telefono ?? ''}).`,
        priorita: 'media',
        scadenza: taskScadenza || null,
        stato: 'aperto',
      }),
    })
    if (res.ok) {
      setTaskOk(true)
      setTimeout(() => setTaskModal(null), 1800)
    } else {
      const data = await res.json().catch(() => ({}))
      setTaskError(data.error ?? 'Errore nella creazione del task')
    }
    setTaskSaving(false)
  }

  // ── Interazioni per contatto ───────────────────────────────────────────────
  const [interazioni, setInterazioni]         = useState<Record<string, CrmInterazione[]>>({})
  const [interazioniLoading, setInterazioniLoading] = useState<string | null>(null)
  const fetchedIdsRef = useRef<Set<string>>(new Set())

  // Form aggiunta interazione (uno solo, associato al contatto espanso)
  const [interazioneFormOpen, setInterazioneFormOpen] = useState<string | null>(null)
  const [interazioneTipo, setInterazioneTipo]         = useState<CrmInterazioneTipo>('chiamata')
  const [interazioneContenuto, setInterazioneContenuto] = useState('')
  const [interazioneProssimaAzione, setInterazioneProssimaAzione] = useState('')
  const [interazioneProssimaData, setInterazioneProssimaData]     = useState('')
  const [interazioneSaving, setInterazioneSaving] = useState(false)
  const [interazioneError, setInterazioneError]   = useState<string | null>(null)

  // Fetch interazioni quando si apre un contatto (lazy, con cache)
  useEffect(() => {
    if (!dettaglioId) return
    if (fetchedIdsRef.current.has(dettaglioId)) return
    fetchedIdsRef.current.add(dettaglioId)

    let cancelled = false
    setInterazioniLoading(dettaglioId)

    fetch(`/api/crm/contatti/${dettaglioId}/interazioni`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setInterazioni(prev => ({ ...prev, [dettaglioId]: data.interazioni ?? [] })) })
      .catch(() => { if (!cancelled) setInterazioni(prev => ({ ...prev, [dettaglioId]: [] })) })
      .finally(() => { if (!cancelled) setInterazioniLoading(null) })

    return () => { cancelled = true }
  }, [dettaglioId])

  // Aggiunta interazione
  async function addInterazione(contattoId: string) {
    if (interazioneSaving) return
    if (!interazioneContenuto.trim()) { setInterazioneError('Inserisci il contenuto dell\'interazione'); return }
    setInterazioneSaving(true)
    setInterazioneError(null)

    const res = await fetch(`/api/crm/contatti/${contattoId}/interazioni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: interazioneTipo,
        contenuto: interazioneContenuto.trim(),
        prossima_azione: interazioneProssimaAzione.trim() || null,
        prossima_data:   interazioneProssimaData || null,
      }),
    })

    if (res.ok) {
      const { interazione } = await res.json()
      setInterazioni(prev => ({ ...prev, [contattoId]: [interazione, ...(prev[contattoId] ?? [])] }))
      setInterazioneContenuto('')
      setInterazioneProssimaAzione('')
      setInterazioneProssimaData('')
      setInterazioneFormOpen(null)
    } else {
      const data = await res.json().catch(() => ({}))
      setInterazioneError(data.error ?? 'Errore nel salvataggio')
    }
    setInterazioneSaving(false)
  }

  function apriFormInterazione(contattoId: string) {
    setInterazioneFormOpen(contattoId)
    setInterazioneTipo('chiamata')
    setInterazioneContenuto('')
    setInterazioneProssimaAzione('')
    setInterazioneProssimaData('')
    setInterazioneError(null)
  }

  // ── Follow-up filters ──────────────────────────────────────────────────────
  const [filtroFollowUp, setFiltroFollowUp] = useState<FiltroFollowUp>('nessuno')
  const [followUpIds, setFollowUpIds]       = useState<string[] | null>(null)
  const [followUpLoading, setFollowUpLoading] = useState(false)

  async function caricaFollowUp(filtro: FiltroFollowUp) {
    if (filtro === 'nessuno') {
      setFiltroFollowUp('nessuno')
      setFollowUpIds(null)
      return
    }
    if (filtroFollowUp === filtro) {
      // Toggle off
      setFiltroFollowUp('nessuno')
      setFollowUpIds(null)
      return
    }
    setFiltroFollowUp(filtro)
    setFollowUpLoading(true)
    try {
      const res = await fetch(`/api/crm/follow-up?filtro=${filtro}`)
      const data = await res.json()
      setFollowUpIds((data.ids ?? []) as string[])
    } catch {
      setFollowUpIds([])
    } finally {
      setFollowUpLoading(false)
    }
  }

  // Paginazione
  const [pagina, setPagina] = useState(0)
  useEffect(() => { setPagina(0) }, [filtro, filtroMarketing, cerca, filtroFollowUp, followUpIds])

  // Filtro contatti
  const filtered = useMemo(() => {
    let list = contatti

    // Follow-up filter ha priorità sugli altri filtri (stato, marketing)
    if (filtroFollowUp !== 'nessuno' && followUpIds !== null) {
      const idSet = new Set(followUpIds)
      list = list.filter(c => idSet.has(c.id))
    } else {
      if (filtro !== 'tutti') list = list.filter(c => c.stato === filtro)
      if (filtroMarketing === 'si')  list = list.filter(c => c.consenso_marketing === true)
      if (filtroMarketing === 'no')  list = list.filter(c => !c.consenso_marketing)
    }

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
  }, [contatti, filtro, filtroMarketing, cerca, filtroFollowUp, followUpIds])

  const totalePagine = Math.ceil(filtered.length / PER_PAGINA)
  const paginati = useMemo(
    () => filtered.slice(pagina * PER_PAGINA, (pagina + 1) * PER_PAGINA),
    [filtered, pagina]
  )

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
    if (statoLoading === id) return // guard doppio-click
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
    if (editSaving) return // guard doppio-click
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
    if (nuovoSaving) return // guard doppio-click
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
        consenso_privacy: false,
        consenso_marketing: false,
        consenso_versione: null,
        consenso_timestamp: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        anonimizzato: false,
        gdpr_deleted_at: null,
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
    const contatto = contatti.find(c => c.id === id)
    const res = await fetch(`/api/crm/contatti/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setContatti(prev => prev.filter(c => c.id !== id))
    }
  }

  // ── Invio email ────────────────────────────────────────────────────────────
  async function inviaEmail() {
    if (!emailModal) return
    if (emailSending) return // guard doppio-click
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
      setTimeout(() => setEmailModal(null), 1800)
    } else {
      const data = await res.json().catch(() => ({}))
      setEmailError(data.error ?? 'Errore durante l\'invio')
    }

    setEmailSending(false)
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const url = filtro !== 'tutti'
      ? `/api/crm/contatti?format=csv&stato=${filtro}`
      : '/api/crm/contatti?format=csv'
    window.open(url, '_blank')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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
            className="input pl-8 pr-3 py-2 placeholder:text-stone/40"
          />
        </div>
        {/* Azioni */}
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded border
                       border-stone/30 text-stone hover:text-obsidian transition-colors"
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
                : 'border-stone/25 text-stone hover:text-obsidian'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              filtro === t.id ? 'bg-gold/30' : 'bg-stone/10'
            }`}>
              {counts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filtro consenso marketing ── */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
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
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-600'
                : 'border-stone/25 text-stone hover:text-obsidian'
            }`}
          >
            {f.id === 'si'  && <Megaphone size={9} />}
            {f.id === 'no'  && <ShieldOff size={9} />}
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Filtro follow-up ── */}
      <div className="flex items-center gap-2 flex-wrap mb-5 pb-4 border-b border-stone/15">
        <span className="text-[10px] text-stone/50 uppercase tracking-widest mr-1 flex items-center gap-1">
          <Clock size={9} /> Follow-up
        </span>
        {([
          { id: 'oggi' as FiltroFollowUp,      label: 'Da richiamare oggi' },
          { id: 'settimana' as FiltroFollowUp, label: 'Questa settimana' },
          { id: 'scaduti' as FiltroFollowUp,   label: 'Scaduti' },
        ] as { id: FiltroFollowUp; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => caricaFollowUp(f.id)}
            disabled={followUpLoading}
            className={`text-xs px-3 py-1 rounded border transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
              filtroFollowUp === f.id
                ? f.id === 'scaduti'
                  ? 'bg-red-500/20 border-red-500/40 text-red-700'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-700'
                : 'border-stone/25 text-stone hover:text-obsidian'
            }`}
          >
            {f.id === 'scaduti' && <AlertCircle size={9} />}
            {f.id !== 'scaduti' && <Clock size={9} />}
            {f.label}
            {filtroFollowUp === f.id && followUpIds !== null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                f.id === 'scaduti' ? 'bg-red-500/20' : 'bg-amber-500/20'
              }`}>
                {followUpIds.length}
              </span>
            )}
          </button>
        ))}
        {filtroFollowUp !== 'nessuno' && (
          <button
            onClick={() => caricaFollowUp('nessuno')}
            className="text-[10px] text-stone/50 hover:text-stone transition-colors px-2 py-1 flex items-center gap-1"
          >
            <X size={9} /> Rimuovi filtro
          </button>
        )}
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
          {paginati.map(c => {
            const si = statoInfo(c.stato)
            const StatoIcon = si.icon
            const isExpanded = dettaglioId === c.id

            return (
              <div key={c.id} className="card">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-stone/10 border border-stone/25
                                  flex items-center justify-center text-stone text-sm font-medium flex-shrink-0">
                    {iniziali(c)}
                  </div>

                  {/* Info principali */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-obsidian">{nomeCompleto(c)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${si.bg} ${si.color}`}>
                        <StatoIcon size={9} />
                        {si.label}
                      </span>
                      <span className="text-[10px] text-stone/45 flex items-center gap-0.5">
                        <Clock size={8} />
                        {formatGiorniAggiornato(c.updated_at)}
                      </span>
                      {c.sorgente && (
                        <span className="text-[10px] px-2 py-0.5 rounded border border-stone/25 text-stone flex items-center gap-1">
                          <Globe size={9} /> {labelSorgente(c.sorgente)}
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
                          ? 'bg-green-500/10 text-green-700'
                          : 'bg-red-500/10 text-red-600/70'
                      }`}>
                        <ShieldCheck size={8} />
                        Privacy {c.consenso_privacy ? '✓' : '✗'}
                      </span>
                      {/* Marketing */}
                      <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                        c.consenso_marketing
                          ? 'bg-blue-500/10 text-blue-600/80'
                          : 'bg-stone/10 text-stone/40'
                      }`}>
                        <Megaphone size={8} />
                        Marketing {c.consenso_marketing ? '✓' : '✗'}
                      </span>
                    </div>

                    {c.note && isExpanded && (
                      <p className="text-xs text-stone/70 mt-1.5 italic">&ldquo;{c.note}&rdquo;</p>
                    )}
                  </div>

                  {/* Toggle dettaglio */}
                  <button
                    onClick={() => setDettaglioId(isExpanded ? null : c.id)}
                    className="text-stone hover:text-obsidian transition-colors p-1 flex-shrink-0"
                  >
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Azioni espanse */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-stone/20">
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
                              : 'border-stone/25 text-stone hover:text-obsidian disabled:opacity-40'
                          }`}
                        >
                          <s.icon size={9} />
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Badge consensi GDPR */}
                    <div className="flex gap-2 flex-wrap mb-3 pb-3 border-b border-stone/15">
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
                        c.consenso_privacy
                          ? 'bg-green-500/10 border-green-500/30 text-green-700'
                          : 'bg-red-500/10 border-red-500/30 text-red-600'
                      }`}>
                        {c.consenso_privacy
                          ? <ShieldCheck size={9} />
                          : <ShieldOff size={9} />
                        }
                        Privacy {c.consenso_privacy ? 'accettata' : 'non accettata'}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${
                        c.consenso_marketing
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                          : 'bg-stone/10 border-stone/25 text-stone/50'
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
                                     bg-violet-500/10 border border-violet-500/30 text-violet-600
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
                                     bg-green-500/10 border border-green-500/30 text-green-700
                                     hover:bg-green-500/20 transition-colors"
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
                                   bg-stone/5 border border-stone/30 text-stone
                                   hover:text-obsidian transition-colors"
                      >
                        Note {c.note ? '✎' : '+'}
                      </button>
                      <button
                        onClick={() => apriTaskModal(c)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                   bg-stone/5 border border-stone/30 text-stone
                                   hover:text-obsidian transition-colors"
                      >
                        <CheckCircle2 size={11} /> Task
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => eliminaContatto(c.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded
                                     bg-red-500/10 border border-red-500/30 text-red-700
                                     hover:bg-red-500/20 transition-colors ml-auto"
                        >
                          <Trash2 size={11} /> Elimina
                        </button>
                      )}
                    </div>

                    {/* ── Storico interazioni ── */}
                    <div className="mt-4 pt-3 border-t border-stone/15">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-stone/70">
                          <History size={11} /> Storico interazioni
                        </span>
                        <button
                          onClick={() =>
                            interazioneFormOpen === c.id
                              ? setInterazioneFormOpen(null)
                              : apriFormInterazione(c.id)
                          }
                          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border
                                     border-gold/35 text-gold hover:bg-gold/10 transition-colors"
                        >
                          <Plus size={9} /> Aggiungi
                        </button>
                      </div>

                      {/* Form aggiunta */}
                      {interazioneFormOpen === c.id && (
                        <div className="mb-3 p-3 rounded-lg border border-stone/20" style={{ backgroundColor: '#F7F4EF' }}>
                          <div className="space-y-2.5">
                            {/* Tipo */}
                            <div>
                              <label className="block text-[10px] text-stone/60 mb-1.5">Tipo interazione</label>
                              <div className="flex gap-1.5 flex-wrap">
                                {TIPI_INTERAZIONE.map(t => (
                                  <button
                                    key={t}
                                    onClick={() => setInterazioneTipo(t)}
                                    className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border transition-colors ${
                                      interazioneTipo === t
                                        ? 'bg-gold/20 border-gold/40 text-gold font-medium'
                                        : 'border-stone/25 text-stone hover:text-obsidian'
                                    }`}
                                  >
                                    <TipoIcon tipo={t} size={9} />
                                    {TIPO_LABEL[t]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Contenuto */}
                            <div>
                              <label className="block text-[10px] text-stone/60 mb-1">
                                Contenuto <span className="text-red-600">*</span>
                              </label>
                              <textarea
                                value={interazioneContenuto}
                                onChange={e => setInterazioneContenuto(e.target.value)}
                                rows={2}
                                className="input resize-none text-xs"
                                placeholder="Es. Chiamato, non risponde. Riproverò domani."
                              />
                            </div>
                            {/* Prossima azione + data */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-stone/60 mb-1">
                                  Prossima azione <span className="text-stone/35">(opz.)</span>
                                </label>
                                <input
                                  value={interazioneProssimaAzione}
                                  onChange={e => setInterazioneProssimaAzione(e.target.value)}
                                  className="input text-xs"
                                  placeholder="Es. Richiama lunedì"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-stone/60 mb-1">
                                  Data follow-up <span className="text-stone/35">(opz.)</span>
                                </label>
                                <input
                                  type="date"
                                  value={interazioneProssimaData}
                                  onChange={e => setInterazioneProssimaData(e.target.value)}
                                  className="input text-xs"
                                />
                              </div>
                            </div>
                            {interazioneError && (
                              <p className="text-[11px] text-red-700 flex items-center gap-1">
                                <AlertCircle size={10} /> {interazioneError}
                              </p>
                            )}
                            <div className="flex gap-2 justify-end pt-0.5">
                              <button
                                onClick={() => setInterazioneFormOpen(null)}
                                disabled={interazioneSaving}
                                className="text-[10px] px-3 py-1.5 rounded border border-stone/30 text-stone hover:text-obsidian transition-colors disabled:opacity-50"
                              >
                                Annulla
                              </button>
                              <button
                                onClick={() => addInterazione(c.id)}
                                disabled={interazioneSaving || !interazioneContenuto.trim()}
                                className="text-[10px] px-3 py-1.5 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-40"
                              >
                                {interazioneSaving ? 'Salvataggio…' : 'Salva interazione'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lista interazioni */}
                      {interazioniLoading === c.id ? (
                        <p className="text-[11px] text-stone/45 py-1">Caricamento…</p>
                      ) : (interazioni[c.id] ?? []).length === 0 ? (
                        <p className="text-[11px] text-stone/40 py-1 italic">Nessuna interazione registrata</p>
                      ) : (
                        <div className="space-y-3">
                          {(interazioni[c.id] ?? []).map(int => (
                            <div key={int.id} className="flex gap-2.5">
                              {/* Icona tipo */}
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="w-6 h-6 rounded-full bg-stone/10 border border-stone/20 flex items-center justify-center">
                                  <TipoIcon tipo={int.tipo} size={10} className="text-stone/60" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-medium text-obsidian/80">{TIPO_LABEL[int.tipo]}</span>
                                  <span className="text-[10px] text-stone/45">{formatDataBreve(int.created_at)}</span>
                                  {int.creato_da_nome && (
                                    <span className="text-[9px] text-stone/35">— {int.creato_da_nome}</span>
                                  )}
                                </div>
                                <p className="text-xs text-stone/75 mt-0.5 leading-relaxed">{int.contenuto}</p>
                                {(int.prossima_azione || int.prossima_data) && (
                                  <div className="flex items-start gap-1 mt-1.5">
                                    <ArrowRight size={9} className="text-gold mt-0.5 flex-shrink-0" />
                                    <span className="text-[10px] text-gold/90 leading-relaxed">
                                      {int.prossima_azione}
                                      {int.prossima_data && (
                                        <span className="text-stone/45 ml-1">
                                          · {formatDataBreve(int.prossima_data)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Paginazione ── */}
      {totalePagine > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone/15">
          <span className="text-xs text-stone/50">
            {pagina * PER_PAGINA + 1}–{Math.min((pagina + 1) * PER_PAGINA, filtered.length)} di {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagina(p => Math.max(0, p - 1))}
              disabled={pagina === 0}
              className="p-1.5 rounded border border-stone/30 text-stone hover:text-obsidian
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-stone min-w-[60px] text-center">
              {pagina + 1} / {totalePagine}
            </span>
            <button
              onClick={() => setPagina(p => Math.min(totalePagine - 1, p + 1))}
              disabled={pagina >= totalePagine - 1}
              className="p-1.5 rounded border border-stone/30 text-stone hover:text-obsidian
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal aggiunta manuale ── */}
      {nuovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border border-stone/25 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" style={{ backgroundColor: '#FDFCFA' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-obsidian font-medium">Nuovo contatto</h2>
              <button onClick={() => setNuovoModal(false)} className="text-stone hover:text-obsidian transition-colors">
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
                    className="input"
                    placeholder="Mario"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone mb-1">Cognome</label>
                  <input
                    value={nuovoForm.cognome}
                    onChange={e => setNuovoForm(p => ({ ...p, cognome: e.target.value }))}
                    className="input"
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
                  className="input"
                  placeholder="mario@esempio.com"
                />
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Telefono</label>
                <input
                  type="tel"
                  value={nuovoForm.telefono}
                  onChange={e => setNuovoForm(p => ({ ...p, telefono: e.target.value }))}
                  className="input"
                  placeholder="+39 340 000 0000"
                />
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Sorgente</label>
                <select
                  value={nuovoForm.sorgente}
                  onChange={e => setNuovoForm(p => ({ ...p, sorgente: e.target.value }))}
                  className="input"
                >
                  {SORGENTI.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Note</label>
                <textarea
                  value={nuovoForm.note}
                  onChange={e => setNuovoForm(p => ({ ...p, note: e.target.value }))}
                  rows={2}
                  className="input resize-none"
                  placeholder="Informazioni aggiuntive…"
                />
              </div>
            </div>

            {nuovoError && (
              <p className="text-red-700 text-xs mt-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {nuovoError}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setNuovoModal(false)}
                disabled={nuovoSaving}
                className="text-xs px-4 py-2 rounded border border-stone/30 text-stone hover:text-obsidian transition-colors disabled:opacity-50"
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
          <div className="border border-stone/25 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl" style={{ backgroundColor: '#FDFCFA' }}>

            <div className="flex items-center justify-between mb-1">
              <h2 className="text-obsidian font-medium flex items-center gap-2">
                <Send size={14} className="text-gold" />
                Invia email
              </h2>
              <button onClick={() => setEmailModal(null)} className="text-stone hover:text-obsidian transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-stone text-xs mb-5">
              A: <span className="text-obsidian">{emailModal.email}</span>
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
                      : 'border-stone/25 hover:border-stone/50'
                  }`}
                >
                  <p className={`text-xs font-medium ${emailTemplate === t.id ? 'text-gold' : 'text-obsidian/80'}`}>{t.label}</p>
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
                  className="input placeholder:text-stone/30"
                />
              </div>
            )}

            {/* Testo libero per template personalizzata */}
            {emailTemplate === 'personalizzata' && (
              <div className="mb-4">
                <label className="block text-xs text-stone mb-1">Messaggio <span className="text-red-700">*</span></label>
                <textarea
                  value={emailCustomBody}
                  onChange={e => setEmailCustomBody(e.target.value)}
                  rows={5}
                  placeholder="Scrivi il messaggio da inviare al paziente…"
                  className="input resize-none placeholder:text-stone/30"
                />
              </div>
            )}

            {emailError && (
              <p className="text-red-700 text-xs mb-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {emailError}
              </p>
            )}
            {emailOk && (
              <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: '#15803D' }}>
                <CheckCircle2 size={12} /> Email inviata con successo
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEmailModal(null)}
                disabled={emailSending}
                className="text-xs px-4 py-2 rounded border border-stone/30 text-stone hover:text-obsidian transition-colors disabled:opacity-50"
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
          <div className="border border-stone/25 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl" style={{ backgroundColor: '#FDFCFA' }}>
            <h2 className="text-obsidian font-medium mb-1">Note — {nomeCompleto(editModal)}</h2>
            <p className="text-stone text-xs mb-4">Aggiungi o modifica le note per questo contatto</p>
            <textarea
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              rows={4}
              autoFocus
              className="input resize-none mb-4"
              placeholder="Inserisci note…"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditModal(null)}
                disabled={editSaving}
                className="text-xs px-4 py-2 rounded border border-stone/30 text-stone hover:text-obsidian transition-colors disabled:opacity-50"
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

      {/* ── Modal task di follow-up ── */}
      {taskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border border-stone/25 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl" style={{ backgroundColor: '#FDFCFA' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-obsidian font-medium">Task di follow-up</h2>
                <p className="text-stone text-xs mt-0.5">{nomeCompleto(taskModal)}</p>
              </div>
              <button onClick={() => setTaskModal(null)} className="text-stone hover:text-obsidian transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone mb-1">Scadenza</label>
                <input
                  type="date"
                  value={taskScadenza}
                  onChange={e => setTaskScadenza(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-stone mb-1">Nota (opzionale)</label>
                <textarea
                  value={taskNota}
                  onChange={e => setTaskNota(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder={`Contattare ${nomeCompleto(taskModal)} per…`}
                />
              </div>
            </div>

            {taskError && (
              <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-700">
                {taskError}
              </div>
            )}
            {taskOk && (
              <div className="mt-3 p-2.5 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-700">
                ✓ Task creato — visibile nella sezione Task
              </div>
            )}

            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setTaskModal(null)}
                disabled={taskSaving}
                className="text-xs px-4 py-2 rounded border border-stone/30 text-stone hover:text-obsidian transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={creaTaskFollowUp}
                disabled={taskSaving || taskOk}
                className="text-xs px-4 py-2 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 size={12} />
                {taskSaving ? 'Creazione…' : 'Crea task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
