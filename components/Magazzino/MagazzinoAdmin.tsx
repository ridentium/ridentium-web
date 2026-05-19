'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { MagazzinoItem, Fornitore } from '@/types'
import { formatDate } from '@/lib/utils'
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ChevronsUpDown, Plus, Pencil, Search, X, Zap, History,
  BellOff, Bell, Clock,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import SottoSogliaOrdina from '@/components/Dashboard/SottoSogliaOrdina'
import Toast, { type ToastState } from '@/components/ui/Toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

function scadenzaColor(scadenza: string | null | undefined): string {
  if (!scadenza) return ''
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const scad = new Date(scadenza); scad.setHours(0, 0, 0, 0)
  const giorni = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000)
  if (giorni < 0) return 'text-red-700'
  if (giorni <= 30) return 'text-amber-600'
  return 'text-emerald-700'
}

/** Etichetta relativa per ultimo_movimento_at */
function ultimoMovimentoLabel(ultimoMovimentoAt: string | null | undefined): string {
  if (!ultimoMovimentoAt) return 'non disponibile'
  const daysAgo = Math.floor((Date.now() - new Date(ultimoMovimentoAt).getTime()) / 86_400_000)
  if (daysAgo === 0) return 'oggi'
  if (daysAgo === 1) return 'ieri'
  return `${daysAgo} gg fa`
}

/** Prodotto dormiente se senza movimenti quantità da ≥ X giorni */
function isDormiente(item: MagazzinoItem, giorniDormiente: number): boolean {
  const ref = item.ultimo_movimento_at ?? item.created_at
  const daysAgo = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
  return daysAgo >= giorniDormiente
}

// ── Priorità — stili badge ─────────────────────────────────────────────────────

type PrioritaMag = 'critica' | 'alta' | 'normale' | 'bassa'

const PRIORITA_BADGE: Record<string, string> = {
  critica: 'bg-red-700/10 text-red-700 border-red-700/20',
  alta:    'bg-amber-600/10 text-amber-700 border-amber-600/20',
  normale: '',
  bassa:   'bg-stone/10 text-stone/50 border-stone/20',
}

// Peso per sort intelligente: alert reali → OK → silenziati, ciascun gruppo per priorità
const PRIORITA_PESO: Record<string, number> = { critica: 0, alta: 1, normale: 2, bassa: 3 }

function alertSortScore(item: MagazzinoItem): number {
  const isRealAlert = item.quantita < item.soglia_minima && !item.alert_silenziato
  const peso = PRIORITA_PESO[item.priorita] ?? 2
  if (item.alert_silenziato) return 100 + peso  // silenziati in fondo
  if (isRealAlert)            return 0   + peso  // alert reali ordinati per priorità (0–3)
  return                             10  + peso   // OK, ordinati per priorità (10–13)
}

// ── Barra copertura scorte ────────────────────────────────────────────────────

function CoperturaBarra({
  quantita, soglia_minima, silenziato,
}: { quantita: number; soglia_minima: number; silenziato: boolean }) {
  if (soglia_minima === 0) return null
  const perc = Math.min(100, Math.round((quantita / soglia_minima) * 100))
  let barClass: string
  if (silenziato)       barClass = 'bg-stone/50'
  else if (perc <= 25)  barClass = 'bg-red-700'
  else if (perc <= 60)  barClass = 'bg-amber-600'
  else if (perc < 100)  barClass = 'bg-gold'
  else                  barClass = 'bg-emerald-600'
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="w-14 h-1 bg-stone/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${silenziato ? 100 : perc}%` }} />
      </div>
      <span className="text-[9px] text-stone/40">{silenziato ? '—' : `${perc}%`}</span>
    </div>
  )
}

// ── Modal silenziamento ───────────────────────────────────────────────────────

interface SilenziaModalProps {
  item: MagazzinoItem
  onClose: () => void
  onConferma: (item: MagazzinoItem, motivo: string) => Promise<void>
}

function SilenziaModal({ item, onClose, onConferma }: SilenziaModalProps) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  async function handleConferma() {
    setSaving(true)
    await onConferma(item, motivo.trim())
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title text-base flex items-center gap-2">
            <BellOff size={15} className="text-stone" /> Silenzia alert
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <p className="text-sm text-obsidian/80 mb-1">
          <span className="font-medium">{item.prodotto}</span> non genererà più alert sotto soglia.
        </p>
        <p className="text-xs text-stone mb-4">Puoi riattivare l&apos;alert in qualsiasi momento.</p>
        <div>
          <label className="label-field block mb-1.5">Motivo (facoltativo)</label>
          <textarea className="input resize-none text-sm" rows={2}
            placeholder="es. prodotto in via di esaurimento programmata"
            value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleConferma} disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <BellOff size={13} /> {saving ? 'Silenziando…' : 'Silenzia alert'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface StoricoEntry {
  id: string; prodotto: string; azione: string; ora: string
}

const CATEGORIE = [
  'Tutte', 'Impianti', 'Componentistica Protesica', 'Materiali Chirurgici',
  'Consumabili', 'Compositi & Cementi', 'Endodonzia',
  'Igiene & Profilassi', 'DPI & Sterilizzazione'
]

const PRIORITA_OPTIONS: { value: PrioritaMag; label: string }[] = [
  { value: 'tutte' as unknown as PrioritaMag, label: 'Tutte' },
  { value: 'critica', label: '● Critica' },
  { value: 'alta',    label: '● Alta' },
  { value: 'normale', label: 'Normale' },
  { value: 'bassa',   label: 'Bassa' },
]

type SortField = 'prodotto' | 'categoria' | 'azienda' | 'diametro' | 'lunghezza' | 'quantita' | 'scadenza'
type SortDir = 'asc' | 'desc'

interface Props {
  items: MagazzinoItem[]
  riordini: any[]
  fornitori?: Fornitore[]
  orderedItemIds?: string[]
  /** Giorni senza movimenti dopo cui un prodotto è dormiente (da settings) */
  giorniDormiente?: number
  /** Giorni alla scadenza per badge critico (default 30) */
  giorniScadenzaCritica?: number
  /** Giorni alla scadenza per badge attenzione (default 90) */
  giorniScadenzaAttenzione?: number
  /** Giorni di copertura stimata sotto cui appare "Finisce presto" (default 14) */
  giorniCopertura?: number
  /** Finestra giorni per calcolo consumo medio (default 30) */
  giorniConsumo?: number
}

interface ItemModalProps {
  item: MagazzinoItem | null
  fornitori: Fornitore[]
  onClose: () => void
  onSave: (updated?: MagazzinoItem) => void
}

interface EvadisciModalState {
  riordineId: string; magazzinoId: string; prodotto: string
  unitaMisura: string; quantitaAttuale: number
}

export default function MagazzinoAdmin({
  items: itemsProp, riordini, fornitori = [], orderedItemIds = [],
  giorniDormiente = 180,
  giorniScadenzaCritica = 30,
  giorniScadenzaAttenzione = 90,
  giorniCopertura = 14,
  giorniConsumo = 30,
}: Props) {
  const [items, setItems] = useState<MagazzinoItem[]>(itemsProp)
  const [categoria, setCategoria] = useState('Tutte')
  const [filtroPriorita, setFiltroPriorita] = useState<PrioritaMag | 'tutte'>('tutte')
  const [evadisciModal, setEvadisciModal] = useState<EvadisciModalState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  const [soloAlert, setSoloAlert] = useState(false)
  const [mostraSilenziati, setMostraSilenziati] = useState(false)
  const [soloOrfani, setSoloOrfani] = useState(false)
  const [silenziandoItem, setSilenziandoItem] = useState<MagazzinoItem | null>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('filter') === 'alert') {
      setSoloAlert(true)
    }
  }, [])

  const [cerca, setCerca] = useState('')
  const [sortField, setSortField] = useState<SortField>('prodotto')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [editItem, setEditItem] = useState<MagazzinoItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showOrdineRapido, setShowOrdineRapido] = useState(false)
  const [storico, setStorico] = useState<StoricoEntry[]>([])
  const [showStorico, setShowStorico] = useState(false)
  const [loadingStorico, setLoadingStorico] = useState(false)
  const [storicoDb, setStoricoDb] = useState<Array<{
    id: string; azione: string; dettaglio: string; user_nome: string; created_at: string
  }> | null>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown size={11} className="text-stone/40 inline ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-gold inline ml-1" />
      : <ChevronDown size={11} className="text-gold inline ml-1" />
  }

  // ── Valori calcolati ──────────────────────────────────────────────────────
  const alertItems    = items.filter(i => i.quantita < i.soglia_minima && !i.alert_silenziato)
  const alertCount    = alertItems.length
  const silenziatiItems  = items.filter(i => i.alert_silenziato)
  const silenziatiCount  = silenziatiItems.length
  const orfaniItems   = items.filter(i => isDormiente(i, giorniDormiente))
  const orfaniCount   = orfaniItems.length

  const filtered = items
    .filter(item => {
      if (categoria !== 'Tutte' && item.categoria !== categoria) return false
      if (filtroPriorita !== 'tutte' && item.priorita !== filtroPriorita) return false
      if (soloAlert && (item.quantita >= item.soglia_minima || item.alert_silenziato)) return false
      if (mostraSilenziati && !item.alert_silenziato) return false
      if (soloOrfani && !isDormiente(item, giorniDormiente)) return false
      if (cerca.trim()) {
        const q = cerca.toLowerCase()
        const match =
          item.prodotto.toLowerCase().includes(q) ||
          (item.azienda ?? '').toLowerCase().includes(q) ||
          (item.codice_articolo ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
    .sort((a, b) => {
      // Impianti con sort default → ordina per diametro poi lunghezza
      if (categoria === 'Impianti' && sortField === 'prodotto') {
        const dA = a.diametro ?? 0, dB = b.diametro ?? 0
        if (dA !== dB) return sortDir === 'asc' ? dA - dB : dB - dA
        const lA = a.lunghezza ?? 0, lB = b.lunghezza ?? 0
        return sortDir === 'asc' ? lA - lB : lB - lA
      }
      // Sort intelligente di default (categoria = Tutte, campo default prodotto)
      if (sortField === 'prodotto' && categoria !== 'Impianti') {
        const sA = alertSortScore(a), sB = alertSortScore(b)
        if (sA !== sB) return sA - sB
        return a.prodotto.localeCompare(b.prodotto, 'it')
      }
      // Sort esplicito per colonna
      let av: any, bv: any
      switch (sortField) {
        case 'prodotto':   av = a.prodotto ?? '';   bv = b.prodotto ?? '';   break
        case 'categoria':  av = a.categoria ?? '';  bv = b.categoria ?? '';  break
        case 'azienda':    av = a.azienda ?? '';    bv = b.azienda ?? '';    break
        case 'diametro':   av = a.diametro ?? 0;    bv = b.diametro ?? 0;    break
        case 'lunghezza':  av = a.lunghezza ?? 0;   bv = b.lunghezza ?? 0;   break
        case 'quantita':   av = a.quantita ?? 0;    bv = b.quantita ?? 0;    break
        case 'scadenza':   av = a.scadenza ?? '';   bv = b.scadenza ?? '';   break
        default:           av = a.prodotto ?? '';   bv = b.prodotto ?? ''
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  async function caricaStoricoDb() {
    setLoadingStorico(true)
    try {
      const res = await fetch('/api/magazzino/storico')
      const json = await res.json()
      setStoricoDb(json.storico ?? [])
      setShowStorico(true)
    } finally { setLoadingStorico(false) }
  }

  function addStorico(prodotto: string, azione: string) {
    setStorico(prev => [{
      id: crypto.randomUUID(), prodotto, azione,
      ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev].slice(0, 20))
  }

  async function saveSoglia(id: string, nuovaSoglia: number) {
    if (nuovaSoglia < 0 || !Number.isFinite(nuovaSoglia)) return
    setItems(prev => prev.map(i => i.id === id ? { ...i, soglia_minima: nuovaSoglia } : i))
    const res = await fetch(`/api/magazzino/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soglia_minima: nuovaSoglia }),
    })
    if (!res.ok) showToast('Errore aggiornamento soglia', 'error')
    else showToast(`Soglia minima aggiornata: ${nuovaSoglia}`)
  }

  async function saveQuantita(id: string, nuovaQuantita: number) {
    const item = items.find(i => i.id === id)
    const eraOk = item ? item.quantita >= item.soglia_minima : true
    const saraAlert = item ? nuovaQuantita < item.soglia_minima : false
    const isSilenziato = item?.alert_silenziato ?? false
    const now = new Date().toISOString()

    setItems(prev => prev.map(i => i.id === id
      ? { ...i, quantita: nuovaQuantita, ultimo_movimento_at: now }
      : i
    ))

    const res = await fetch(`/api/magazzino/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantita: nuovaQuantita }),
    })
    if (!res.ok) {
      showToast('Errore aggiornamento quantità', 'error')
    } else {
      showToast(saraAlert && !isSilenziato ? 'Sotto soglia — verifica il riordino' : `Quantità aggiornata: ${nuovaQuantita}`)
      if (item) addStorico(item.prodotto, `${item.quantita} → ${nuovaQuantita} ${item.unita ?? 'pz'}`)
    }

    if (eraOk && saraAlert && item && !isSilenziato) {
      fetch('/api/magazzino/check-soglia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, prodotto: item.prodotto, quantita: nuovaQuantita, soglia_minima: item.soglia_minima }),
      }).catch(() => {})
    }
  }

  async function toggleSilenzia(item: MagazzinoItem, motivo?: string) {
    const nuovoStato = !item.alert_silenziato
    const res = await fetch(`/api/magazzino/${item.id}/silenzia`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ silenziato: nuovoStato, motivo: motivo ?? null }),
    })
    if (!res.ok) { showToast('Errore aggiornamento alert', 'error'); return }
    const { item: updated } = await res.json()
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    showToast(nuovoStato ? 'Alert silenziato' : 'Alert riattivato')
    setSilenziandoItem(null)
  }

  function apriEvadisci(riordine: any) {
    const item = items.find(i => i.id === riordine.magazzino_id)
    setEvadisciModal({
      riordineId: riordine.id, magazzinoId: riordine.magazzino_id,
      prodotto: item?.prodotto ?? riordine.magazzino?.prodotto ?? 'Prodotto',
      unitaMisura: item?.unita ?? 'pz', quantitaAttuale: item?.quantita ?? 0,
    })
  }

  async function confermaEvadisci(qtyRicevuta: number) {
    if (!evadisciModal) return
    const nuovaQty = evadisciModal.quantitaAttuale + qtyRicevuta
    const res = await fetch('/api/magazzino/evadisci', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        riordine_id: evadisciModal.riordineId, magazzino_id: evadisciModal.magazzinoId,
        qty_ricevuta: qtyRicevuta,
      }),
    })
    if (!res.ok) {
      showToast('Errore durante la ricezione merce', 'error')
    } else {
      const now = new Date().toISOString()
      setItems(prev => prev.map(i =>
        i.id === evadisciModal!.magazzinoId
          ? { ...i, quantita: nuovaQty, ultimo_movimento_at: now }
          : i
      ))
      showToast(`Merce ricevuta — giacenza aggiornata a ${nuovaQty}`)
      addStorico(evadisciModal.prodotto, `Ricevute ${qtyRicevuta} pz → giacenza ${nuovaQty}`)
    }
    setEvadisciModal(null)
    startTransition(() => router.refresh())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Riordini aperti */}
      {riordini.length > 0 && (
        <div className="card border-gold/20 bg-gold/5">
          <h3 className="text-xs uppercase tracking-widest text-gold mb-3">
            Richieste di Riordino ({riordini.length})
          </h3>
          <div className="space-y-2">
            {riordini.map((r: any) => {
              const item = items.find(i => i.id === r.magazzino_id)
              const prodotto = item?.prodotto ?? r.magazzino?.prodotto ?? '—'
              return (
                <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-stone/20 last:border-0">
                  <div>
                    <p className="text-sm text-obsidian font-medium">{prodotto}</p>
                    <p className="text-xs text-stone mt-0.5">
                      da {r.profili?.nome} {r.profili?.cognome} · {formatDate(r.created_at)}
                    </p>
                    {r.note && <p className="text-xs text-stone/70 italic mt-0.5">&ldquo;{r.note}&rdquo;</p>}
                  </div>
                  <button onClick={() => apriEvadisci(r)} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    Merce arrivata
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ordine Rapido — solo alert reali non silenziati */}
      {alertItems.length > 0 && (
        <div className="card border-gold/20">
          <button onClick={() => setShowOrdineRapido(v => !v)} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-gold" />
              <h3 className="text-xs uppercase tracking-widest text-gold">
                Ordine Rapido — {alertItems.length} prodott{alertItems.length === 1 ? 'o' : 'i'} sotto soglia
                {alertItems.filter(i => i.priorita === 'critica').length > 0 && (
                  <span className="ml-2 text-red-700 font-semibold">
                    ({alertItems.filter(i => i.priorita === 'critica').length} critici)
                  </span>
                )}
              </h3>
            </div>
            {showOrdineRapido ? <ChevronUp size={14} className="text-stone" /> : <ChevronDown size={14} className="text-stone" />}
          </button>
          {showOrdineRapido && (
            <div className="mt-4">
              <SottoSogliaOrdina
                alertItems={alertItems.filter(i => i.priorita !== 'bassa')} // escludi bassa dall'ordine rapido
                fornitori={fornitori}
                orderedItemIds={orderedItemIds}
              />
              {alertItems.filter(i => i.priorita === 'bassa').length > 0 && (
                <p className="text-[10px] text-stone/40 mt-2 italic">
                  {alertItems.filter(i => i.priorita === 'bassa').length} prodotto/i a bassa priorità non inclusi nell&apos;ordine rapido.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Barra cerca + aggiungi */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone pointer-events-none" />
          <input type="text" placeholder="Cerca prodotto, azienda, codice…"
            value={cerca} onChange={e => setCerca(e.target.value)}
            className="input pl-8 pr-8 py-2 text-sm w-full" />
          {cerca && (
            <button onClick={() => setCerca('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone hover:text-obsidian transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      {/* Filtri — riga 1: categoria + alert + silenziati + dormienti */}
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-2" style={{ width: 'max-content' }}>
            {CATEGORIE.map(cat => (
              <button key={cat} onClick={() => setCategoria(cat)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors whitespace-nowrap ${
                  categoria === cat
                    ? 'bg-gold text-obsidian border-gold'
                    : 'border-stone/30 text-stone hover:border-stone hover:text-obsidian'
                }`}>{cat}</button>
            ))}
          </div>
        </div>
        {/* Alert */}
        <button
          onClick={() => { setSoloAlert(!soloAlert); if (mostraSilenziati) setMostraSilenziati(false) }}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
            soloAlert ? 'bg-red-400/10 text-red-400 border-red-400/30' : 'border-stone/30 text-stone hover:border-stone hover:text-obsidian'
          }`}>
          <AlertTriangle size={11} />
          <span className="hidden sm:inline">Sotto soglia</span>
          <span className="text-xs">({alertCount})</span>
        </button>
        {/* Silenziati */}
        {silenziatiCount > 0 && (
          <button
            onClick={() => { setMostraSilenziati(!mostraSilenziati); if (soloAlert) setSoloAlert(false) }}
            className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
              mostraSilenziati ? 'bg-stone/20 text-stone border-stone/40' : 'border-stone/30 text-stone/60 hover:border-stone hover:text-obsidian'
            }`}>
            <BellOff size={11} />
            <span className="hidden sm:inline">Silenziati</span>
            <span className="text-xs">({silenziatiCount})</span>
          </button>
        )}
        {/* Dormienti */}
        {orfaniCount > 0 && (
          <button onClick={() => setSoloOrfani(!soloOrfani)}
            className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
              soloOrfani ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' : 'border-stone/30 text-stone/60 hover:border-stone hover:text-obsidian'
            }`}>
            <Clock size={11} />
            <span className="hidden sm:inline">Dormienti</span>
            <span className="text-xs">({orfaniCount})</span>
          </button>
        )}
      </div>

      {/* Filtri — riga 2: priorità (sempre visibile, compatta) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-stone/40 uppercase tracking-wider mr-1">Priorità</span>
        {(['tutte', 'critica', 'alta', 'normale', 'bassa'] as const).map(p => (
          <button key={p} onClick={() => setFiltroPriorita(p as PrioritaMag | 'tutte')}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              filtroPriorita === p
                ? p === 'critica' ? 'bg-red-700/10 text-red-700 border-red-700/30'
                  : p === 'alta'  ? 'bg-amber-600/10 text-amber-700 border-amber-600/30'
                  : p === 'bassa' ? 'bg-stone/15 text-stone border-stone/40'
                  : 'bg-gold text-obsidian border-gold'
                : 'border-stone/25 text-stone/60 hover:border-stone/50 hover:text-obsidian'
            }`}>
            {p === 'tutte' ? 'Tutte' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Risultati */}
      {cerca && (
        <p className="text-xs text-stone">
          {filtered.length} risultat{filtered.length === 1 ? 'o' : 'i'}
          {categoria !== 'Tutte' ? ` in ${categoria}` : ''}
          {' '}per <span className="text-obsidian">&ldquo;{cerca}&rdquo;</span>
        </p>
      )}

      {/* ── Vista card su mobile ── */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="card text-center py-8 text-stone text-sm">
            {cerca ? `Nessun prodotto trovato per "${cerca}"` : 'Nessun prodotto trovato'}
          </div>
        ) : filtered.map(item => {
          const isAlert    = item.quantita < item.soglia_minima && !item.alert_silenziato
          const isSilenziato = item.alert_silenziato
          const dormiente  = isDormiente(item, giorniDormiente)
          const ultMov     = ultimoMovimentoLabel(item.ultimo_movimento_at)
          return (
            <div key={item.id} className={`card p-4 ${
              isAlert ? 'border-red-400/20 bg-red-400/5'
              : isSilenziato ? 'border-stone/20 bg-stone/5' : ''
            }`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-obsidian leading-snug">{item.prodotto}</p>
                    {item.priorita !== 'normale' && PRIORITA_BADGE[item.priorita] && (
                      <span className={`text-[9px] px-1 py-0.5 rounded border ${PRIORITA_BADGE[item.priorita]}`}>
                        {item.priorita.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone mt-0.5">
                    {item.azienda ?? ''}{item.azienda && item.categoria ? ' · ' : ''}{item.categoria}
                  </p>
                  {item.fornitore_id && (() => {
                    const f = fornitori.find(f => f.id === item.fornitore_id)
                    return f ? <p className="text-xs text-stone/50 mt-0.5">Fornitore: {f.nome}</p> : null
                  })()}
                  {(item.diametro || item.lunghezza) && (
                    <p className="text-xs text-stone/60 mt-0.5">
                      {item.diametro ? `ø${item.diametro}` : ''}{item.diametro && item.lunghezza ? ' ' : ''}{item.lunghezza ? `${item.lunghezza}mm` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isSilenziato
                    ? <button title="Riattiva alert" onClick={() => toggleSilenzia(item)} className="p-1.5 text-stone/40 hover:text-gold transition-colors"><Bell size={13} /></button>
                    : <button title="Silenzia alert" onClick={() => setSilenziandoItem(item)} className="p-1.5 text-stone/40 hover:text-stone transition-colors"><BellOff size={13} /></button>
                  }
                  <button onClick={() => setEditItem(item)} className="p-1.5 text-stone/50 hover:text-gold transition-colors">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="flex items-start gap-3">
                  <div>
                    <p className="text-[9px] text-stone/50 uppercase tracking-wider mb-0.5">Qtà</p>
                    <QuantitaEditor value={item.quantita} onChange={val => saveQuantita(item.id, val)} />
                    <CoperturaBarra quantita={item.quantita} soglia_minima={item.soglia_minima} silenziato={isSilenziato} />
                    <p className="text-[9px] text-stone/40 mt-0.5"><Clock size={8} className="inline mr-0.5" />{ultMov}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-stone/50 uppercase tracking-wider mb-0.5">Min.</p>
                    <SogliaMinimaEditor value={item.soglia_minima} onChange={val => saveSoglia(item.id, val)} />
                  </div>
                  {item.scadenza && (
                    <div>
                      <p className="text-[9px] text-stone/50 uppercase tracking-wider mb-0.5">Scad.</p>
                      <p className={`text-xs ${scadenzaColor(item.scadenza) || 'text-stone'}`}>{formatDate(item.scadenza)}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isSilenziato
                    ? <span className="badge text-[10px] text-stone border-stone/30 bg-stone/10 flex items-center gap-1"><BellOff size={9} /> Silenziato</span>
                    : isAlert
                      ? <span className="badge-alert text-[10px]"><AlertTriangle size={9} /> Sotto soglia</span>
                      : <span className="badge-ok text-[10px]"><CheckCircle size={9} /> OK</span>
                  }
                  {dormiente && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/5 text-amber-700 flex items-center gap-0.5">
                      <Clock size={8} /> Dormiente
                    </span>
                  )}
                </div>
              </div>
              {isSilenziato && item.alert_silenziato_motivo && (
                <p className="text-[10px] text-stone/50 italic mt-1.5 border-t border-stone/10 pt-1.5">
                  {item.alert_silenziato_motivo}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Tabella su desktop ── */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-ridentium" style={{ minWidth: '980px' }}>
            <thead>
              <tr>
                <th><button onClick={() => toggleSort('prodotto')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">Prodotto <SortIcon field="prodotto" /></button></th>
                <th><button onClick={() => toggleSort('categoria')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">Categoria <SortIcon field="categoria" /></button></th>
                <th><button onClick={() => toggleSort('azienda')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">Azienda <SortIcon field="azienda" /></button></th>
                <th>Fornitore</th>
                <th><button onClick={() => toggleSort('diametro')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">Ø <SortIcon field="diametro" /></button></th>
                <th><button onClick={() => toggleSort('lunghezza')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">L (mm) <SortIcon field="lunghezza" /></button></th>
                <th><button onClick={() => toggleSort('quantita')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">Qtà <SortIcon field="quantita" /></button></th>
                <th>Min.</th>
                <th>Stato</th>
                <th><button onClick={() => toggleSort('scadenza')} className="flex items-center gap-0.5 hover:text-obsidian transition-colors">Scadenza <SortIcon field="scadenza" /></button></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center text-stone py-8">
                  {cerca ? `Nessun prodotto trovato per "${cerca}"` : 'Nessun prodotto trovato'}
                </td></tr>
              ) : filtered.map(item => {
                const isAlert    = item.quantita < item.soglia_minima && !item.alert_silenziato
                const isSilenziato = item.alert_silenziato
                const dormiente  = isDormiente(item, giorniDormiente)
                const ultMov     = ultimoMovimentoLabel(item.ultimo_movimento_at)
                return (
                  <tr key={item.id} className={isAlert ? 'bg-red-400/5' : isSilenziato ? 'bg-stone/5' : ''}>
                    {/* Prodotto + badge priorità */}
                    <td className="font-medium text-obsidian">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.prodotto}
                        {item.priorita !== 'normale' && PRIORITA_BADGE[item.priorita] && (
                          <span className={`text-[9px] px-1 py-0.5 rounded border ${PRIORITA_BADGE[item.priorita]}`}>
                            {item.priorita.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {isSilenziato && item.alert_silenziato_motivo && (
                        <p className="text-[9px] text-stone/50 italic font-normal mt-0.5 max-w-[180px] truncate">
                          {item.alert_silenziato_motivo}
                        </p>
                      )}
                    </td>
                    <td>{item.categoria}</td>
                    <td>{item.azienda ?? '—'}</td>
                    <td>{fornitori.find(f => f.id === item.fornitore_id)?.nome ?? '—'}</td>
                    <td>{item.diametro ? `ø${item.diametro}` : '—'}</td>
                    <td>{item.lunghezza ? `${item.lunghezza}mm` : '—'}</td>
                    {/* Qtà + barra + ultimo movimento */}
                    <td>
                      <QuantitaEditor value={item.quantita} onChange={val => saveQuantita(item.id, val)} />
                      <CoperturaBarra quantita={item.quantita} soglia_minima={item.soglia_minima} silenziato={isSilenziato} />
                      <p className="text-[9px] text-stone/35 mt-0.5 flex items-center gap-0.5">
                        <Clock size={8} /> {ultMov}
                      </p>
                    </td>
                    <td><SogliaMinimaEditor value={item.soglia_minima} onChange={val => saveSoglia(item.id, val)} /></td>
                    {/* Stato: alert/ok/silenziato + dormiente */}
                    <td>
                      <div className="flex flex-col gap-1">
                        {isSilenziato
                          ? <span className="badge text-[10px] text-stone border-stone/30 bg-stone/10 flex items-center gap-1 w-fit"><BellOff size={9} /> Silenziato</span>
                          : isAlert
                            ? <span className="badge-alert"><AlertTriangle size={10} /> Sotto soglia</span>
                            : <span className="badge-ok"><CheckCircle size={10} /> OK</span>
                        }
                        {dormiente && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/5 text-amber-700 flex items-center gap-0.5 w-fit">
                            <Clock size={8} /> Dormiente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={scadenzaColor(item.scadenza)}>{formatDate(item.scadenza ?? undefined)}</td>
                    {/* Azioni */}
                    <td>
                      <div className="flex items-center gap-1">
                        {isSilenziato
                          ? <button title="Riattiva alert" onClick={() => toggleSilenzia(item)} className="btn-ghost p-1.5 text-stone/40 hover:text-gold"><Bell size={13} /></button>
                          : <button title="Silenzia alert" onClick={() => setSilenziandoItem(item)} className="btn-ghost p-1.5 text-stone/40 hover:text-stone"><BellOff size={13} /></button>
                        }
                        <button onClick={() => setEditItem(item)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal merce arrivata */}
      {evadisciModal && (
        <EvadisciModal
          prodotto={evadisciModal.prodotto} unitaMisura={evadisciModal.unitaMisura}
          quantitaAttuale={evadisciModal.quantitaAttuale}
          onClose={() => setEvadisciModal(null)} onConferma={confermaEvadisci}
        />
      )}

      {/* Modal silenzia alert */}
      {silenziandoItem && (
        <SilenziaModal
          item={silenziandoItem}
          onClose={() => setSilenziandoItem(null)}
          onConferma={(item, motivo) => toggleSilenzia(item, motivo)}
        />
      )}

      {/* Modal modifica/aggiunta */}
      {(editItem || showAddForm) && (
        <ItemModal
          item={editItem}
          fornitori={fornitori}
          onClose={() => { setEditItem(null); setShowAddForm(false) }}
          onSave={(updated?: MagazzinoItem) => {
            setEditItem(null); setShowAddForm(false)
            if (updated) {
              setItems(prev => {
                const exists = prev.find(i => i.id === updated.id)
                return exists ? prev.map(i => i.id === updated.id ? updated : i) : [...prev, updated]
              })
              showToast(editItem ? 'Prodotto aggiornato' : 'Prodotto aggiunto')
            }
            startTransition(() => router.refresh())
          }}
        />
      )}

      {/* Storico movimenti */}
      <div className="card border-stone/30">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowStorico(v => !v)} className="flex items-center gap-2">
            <History size={13} className="text-stone/60" />
            <h3 className="text-xs uppercase tracking-widest text-stone">
              Storico movimenti
              {storico.length > 0 && <span className="ml-1 text-stone/40">({storico.length} questa sessione)</span>}
            </h3>
            {showStorico ? <ChevronUp size={13} className="text-stone/40 ml-1" /> : <ChevronDown size={13} className="text-stone/40 ml-1" />}
          </button>
          {storicoDb === null && (
            <button onClick={caricaStoricoDb} disabled={loadingStorico}
              className="text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40">
              {loadingStorico ? 'Caricamento…' : 'Carica storico completo →'}
            </button>
          )}
        </div>
        {showStorico && (
          <div className="mt-3 space-y-1">
            {storico.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] uppercase tracking-widest text-stone/40 mb-1.5">Questa sessione</p>
                {storico.map(s => (
                  <div key={s.id} className="flex items-start gap-3 py-1.5 border-b border-stone/15 last:border-0">
                    <span className="text-[10px] text-stone/40 w-10 flex-shrink-0 pt-0.5">{s.ora}</span>
                    <span className="text-xs text-obsidian/80 font-medium flex-shrink-0 max-w-[160px] truncate">{s.prodotto}</span>
                    <span className="text-xs text-stone">{s.azione}</span>
                  </div>
                ))}
              </div>
            )}
            {storicoDb !== null && (
              <div>
                {storico.length > 0 && <p className="text-[9px] uppercase tracking-widest text-stone/40 mb-1.5 mt-3">Precedenti</p>}
                {storicoDb.length === 0
                  ? <p className="text-xs text-stone/40 py-3 text-center italic">Nessun movimento registrato</p>
                  : storicoDb.map(s => (
                    <div key={s.id} className="flex items-start gap-3 py-1.5 border-b border-stone/15 last:border-0">
                      <span className="text-[10px] text-stone/40 w-24 flex-shrink-0 pt-0.5">
                        {new Date(s.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        {' '}{new Date(s.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-stone/50 flex-shrink-0 max-w-[100px] truncate">{s.user_nome}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-obsidian/80 truncate">{s.azione.replace(/^Quantità aggiornata: |^Merce ricevuta: /, '')}</p>
                        {s.dettaglio && <p className="text-[10px] text-stone/60">{s.dettaglio}</p>}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
            {storico.length === 0 && storicoDb === null && (
              <p className="text-xs text-stone/40 py-3 text-center italic">
                Nessun movimento in questa sessione. Carica lo storico completo per vedere i precedenti.
              </p>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}

// ── Sub-componenti ────────────────────────────────────────────────────────────

function EvadisciModal({ prodotto, unitaMisura, quantitaAttuale, onClose, onConferma }: {
  prodotto: string; unitaMisura: string; quantitaAttuale: number
  onClose: () => void; onConferma: (qty: number) => Promise<void>
}) {
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  async function handleConferma() {
    const n = Number(qty)
    if (!n || n <= 0) return
    setSaving(true); await onConferma(n); setSaving(false)
  }
  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-base">Merce arrivata</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <p className="text-sm text-obsidian font-medium">{prodotto}</p>
        <p className="text-xs text-stone mt-1">Giacenza attuale: <span className="text-obsidian">{quantitaAttuale} {unitaMisura}</span></p>
        <div className="mt-4">
          <label className="label-field block mb-1.5">Quantità ricevuta ({unitaMisura})</label>
          <input type="number" min="1" step="1" className="input text-lg text-center font-medium"
            value={qty} onChange={e => setQty(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConferma() }}
            placeholder="0" autoFocus />
          {qty && Number(qty) > 0 && (
            <p className="text-xs text-stone/60 mt-2 text-center">
              Nuova giacenza: <span className="text-green-700 font-medium">{quantitaAttuale + Number(qty)} {unitaMisura}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleConferma} disabled={!qty || Number(qty) <= 0 || saving}
            className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Conferma ricezione'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuantitaEditor({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-obsidian hover:text-gold transition-colors font-medium">
        {value}
      </button>
    )
  }
  return (
    <input type="number" value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(Number(val)); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(Number(val)); setEditing(false) } }}
      className="input w-16 py-1 text-center text-sm" autoFocus />
  )
}

function SogliaMinimaEditor({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))
  if (!editing) {
    return (
      <button onClick={() => { setVal(String(value)); setEditing(true) }}
        className="text-stone hover:text-gold transition-colors" title="Clicca per modificare la soglia minima">
        {value}
      </button>
    )
  }
  return (
    <input type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { const n = Number(val); if (n >= 0 && n !== value) onChange(n); setEditing(false) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { const n = Number(val); if (n >= 0 && n !== value) onChange(n); setEditing(false) }
        if (e.key === 'Escape') setEditing(false)
      }}
      className="input w-16 py-1 text-center text-sm" autoFocus />
  )
}

function ItemModal({ item, fornitori, onClose, onSave }: ItemModalProps) {
  const [form, setForm] = useState<Partial<MagazzinoItem>>(item ?? {
    prodotto: '', categoria: 'Impianti', azienda: 'Neodent',
    quantita: 0, soglia_minima: 2, unita: 'pz', priorita: 'normale',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      let data: MagazzinoItem | undefined
      if (item) {
        const res = await fetch(`/api/magazzino/${item.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        data = json.item
      } else {
        const res = await fetch('/api/magazzino', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json()
        data = json.item
      }
      onSave(data)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">{item ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label-field block mb-1.5">Prodotto *</label>
            <input className="input" value={form.prodotto ?? ''} onChange={e => set('prodotto', e.target.value)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Categoria</label>
            <select className="input" value={form.categoria ?? ''} onChange={e => set('categoria', e.target.value)}>
              {['Impianti','Componentistica Protesica','Materiali Chirurgici','Consumabili',
                'Compositi & Cementi','Endodonzia','Igiene & Profilassi','DPI & Sterilizzazione'].map(c =>
                <option key={c}>{c}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label-field block mb-1.5">Priorità operativa</label>
            <select className="input" value={form.priorita ?? 'normale'} onChange={e => set('priorita', e.target.value)}>
              <option value="critica">⚠ Critica — essenziale, ordine immediato</option>
              <option value="alta">▲ Alta — importante, ordine prioritario</option>
              <option value="normale">● Normale</option>
              <option value="bassa">▽ Bassa — non urgente</option>
            </select>
          </div>
          <div>
            <label className="label-field block mb-1.5">Azienda</label>
            <input className="input" value={form.azienda ?? ''} onChange={e => set('azienda', e.target.value)} />
          </div>
          {fornitori.length > 0 && (
            <div className="col-span-2">
              <label className="label-field block mb-1.5">Fornitore (per riordino automatico)</label>
              <select className="input" value={form.fornitore_id ?? ''} onChange={e => set('fornitore_id', e.target.value || null)}>
                <option value="">— Nessun fornitore —</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label-field block mb-1.5">Codice Articolo</label>
            <input className="input" value={form.codice_articolo ?? ''} onChange={e => set('codice_articolo', e.target.value)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Unità</label>
            <select className="input" value={form.unita ?? 'pz'} onChange={e => set('unita', e.target.value)}>
              {['pz','conf','ml','rotoli','kit','scatole'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field block mb-1.5">Quantità</label>
            <input type="number" className="input" value={form.quantita ?? 0} onChange={e => set('quantita', +e.target.value)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Soglia Minima</label>
            <input type="number" className="input" value={form.soglia_minima ?? 0} onChange={e => set('soglia_minima', +e.target.value)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Diametro (mm)</label>
            <input type="number" step="0.1" className="input" value={form.diametro ?? ''} onChange={e => set('diametro', e.target.value ? +e.target.value : null)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Lunghezza (mm)</label>
            <input type="number" step="0.5" className="input" value={form.lunghezza ?? ''} onChange={e => set('lunghezza', e.target.value ? +e.target.value : null)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Scadenza</label>
            <input type="date" className="input" value={form.scadenza ?? ''} onChange={e => set('scadenza', e.target.value || null)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Prezzo Unitario (€)</label>
            <input type="number" step="0.01" className="input" value={form.prezzo_unitario ?? ''} onChange={e => set('prezzo_unitario', e.target.value ? +e.target.value : null)} />
          </div>
          <div className="col-span-2">
            <label className="label-field block mb-1.5">Note</label>
            <textarea className="input resize-none" rows={2} value={form.note ?? ''} onChange={e => set('note', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
