'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Ordine, MagazzinoItem, Fornitore } from '@/types'
import { logActivity } from '@/lib/registro'
import {
  MessageCircle, Mail, Check, X, AlertCircle,
  Package, ChevronDown, ChevronUp, ShoppingCart, Globe, Phone,
  Plus, Trash2
} from 'lucide-react'

interface Props {
  ordini: Ordine[]
  userId: string
  userNome: string
  fornitori?: Fornitore[]
}

type Filtro = 'tutti' | 'aperti' | 'ricevuti' | 'annullati'

const STATO_LABEL: Record<string, string> = {
  inviato: 'Inviato',
  ricevuto: 'Ricevuto',
  parziale: 'Parz. ricevuto',
  annullato: 'Annullato',
}

const STATO_COLOR: Record<string, string> = {
  inviato:   'text-gold border-gold/30 bg-gold/10',
  ricevuto:  'text-green-400 border-green-500/30 bg-green-500/10',
  parziale:  'text-blue-400 border-blue-500/30 bg-blue-500/10',
  annullato: 'text-stone border-stone/30 bg-stone/10',
}

// Estende OrdineRiga con il campo quantita_ricevuta salvato durante la ricezione
interface OrdineRigaConRicevuta {
  quantita_ricevuta?: number | null
}

interface NuovaRiga {
  magazzino_id: string
  prodotto_nome: string
  quantita: number
  unita: string
}

export default function OrdiniAdmin({ ordini: initialOrdini, userId, userNome, fornitori = [] }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [ordini, setOrdini] = useState(initialOrdini)
  const [filtro, setFiltro] = useState<Filtro>('tutti')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Modal ricezione (totale o parziale)
  const [ricezioneModal, setRicezioneModal] = useState<{ ordine: Ordine } | null>(null)
  const [ricezioneStep, setRicezioneStep] = useState<'tipo' | 'dettaglio'>('tipo')
  const [ricezioneTipo, setRicezioneTipo] = useState<'totale' | 'parziale' | null>(null)
  const [quantitaRicevute, setQuantitaRicevute] = useState<Record<string, number>>({})
  const [ricezioneNote, setRicezioneNote] = useState('')
  const [ricezioneSaving, setRicezioneSaving] = useState(false)
  const [ricezioneError, setRicezioneError] = useState<string | null>(null)

  // Modal annulla
  const [annullaModal, setAnnullaModal] = useState<{ ordineId: string } | null>(null)
  const [annullaNote, setAnnullaNote] = useState('')
  const [annullaError, setAnnullaError] = useState<string | null>(null)
  const [annullaSaving, setAnnullaSaving] = useState(false)

  // Modal nuovo ordine
  const [nuovoModal, setNuovoModal] = useState(false)
  const [nuovoFornitore, setNuovoFornitore] = useState('')
  const [nuovoCanale, setNuovoCanale] = useState<'whatsapp' | 'email' | 'eshop' | 'telefono'>('whatsapp')
  const [nuovoRighe, setNuovoRighe] = useState<NuovaRiga[]>([
    { magazzino_id: '', prodotto_nome: '', quantita: 1, unita: 'pz' }
  ])
  const [nuovoNote, setNuovoNote] = useState('')
  const [nuovoSaving, setNuovoSaving] = useState(false)
  const [magazzino, setMagazzino] = useState<MagazzinoItem[]>([])
  const [magazzinoLoaded, setMagazzinoLoaded] = useState(false)

  const aperti    = ordini.filter(o => o.stato === 'inviato' || o.stato === 'parziale')
  const ricevuti  = ordini.filter(o => o.stato === 'ricevuto')
  const annullati = ordini.filter(o => o.stato === 'annullato')

  const filtered = filtro === 'tutti'    ? ordini
    : filtro === 'aperti'   ? aperti
    : filtro === 'ricevuti' ? ricevuti
    : annullati

  function apriRicezione(ordine: Ordine) {
    setRicezioneModal({ ordine })
    setRicezioneStep('tipo')
    setRicezioneTipo(null)
    setQuantitaRicevute({})
    setRicezioneNote('')
    setRicezioneError(null)
  }

  function selezionaTipo(tipo: 'totale' | 'parziale') {
    setRicezioneTipo(tipo)
    const q: Record<string, number> = {}
    ricezioneModal!.ordine.righe?.forEach(r => {
      q[r.id] = tipo === 'totale' ? r.quantita_ordinata : 0
    })
    setQuantitaRicevute(q)
    setRicezioneStep('dettaglio')
  }

  async function confermaRicezione() {
    if (!ricezioneModal || !ricezioneTipo) return
    if (ricezioneSaving) return // guard doppio-click
    setRicezioneSaving(true)
    setRicezioneError(null)

    const righe = ricezioneModal.ordine.righe ?? []
    const nuovoStato = ricezioneTipo === 'totale' ? 'ricevuto' : 'parziale'
    const ordineId = ricezioneModal.ordine.id
    setLoading(ordineId)

    // Delega tutto all'API route (usa admin client server-side, bypassa RLS)
    const res = await fetch(`/api/ordini/${ordineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ricevi',
        tipo: ricezioneTipo,
        quantitaRicevute,
        note: ricezioneNote,
        righe,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setRicezioneError(body.error ?? 'Errore nel salvataggio. Riprova.')
      setLoading(null)
      setRicezioneSaving(false)
      return
    }

    const { updates } = await res.json()

    // Aggiorna stato locale incluse le quantita_ricevute
    const righeAggiornate = righe.map(r => ({
      ...r,
      quantita_ricevuta: quantitaRicevute[r.id] ?? null,
    }))
    setOrdini(prev => prev.map(o =>
      o.id === ordineId
        ? { ...o, ...updates, righe: righeAggiornate } as Ordine
        : o
    ))

    const prodottiRicevuti = righe
      .filter(r => (quantitaRicevute[r.id] ?? 0) > 0)
      .map(r => `${r.prodotto_nome}: +${quantitaRicevute[r.id]} ${r.unita ?? 'pz'}`)
      .join(', ')
    await logActivity(
      userId, userNome,
      `Ordine ${STATO_LABEL[nuovoStato].toLowerCase()}: ${ricezioneModal.ordine.fornitore_nome}`,
      prodottiRicevuti || undefined,
      'magazzino'
    )
    setLoading(null)
    setRicezioneModal(null)
    router.refresh()
    setRicezioneSaving(false)
  }

  async function cambiaStatoAnnullato(ordineId: string, note?: string) {
    if (annullaSaving) return // guard doppio-click
    setAnnullaSaving(true)
    setLoading(ordineId)
    setAnnullaError(null)
    const ordine = ordini.find(o => o.id === ordineId)

    // Delega tutto all'API route (usa admin client server-side, bypassa RLS)
    const res = await fetch(`/api/ordini/${ordineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'annulla',
        note: note ?? '',
        statoCorrente: ordine?.stato ?? '',
        righe: ordine?.righe ?? [],
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setAnnullaError(body.error ?? 'Errore nel salvataggio. Riprova.')
      setLoading(null)
      setAnnullaSaving(false)
      return
    }

    if (res.ok) {
      const { updates } = await res.json()
      setOrdini(prev => prev.map(o => o.id === ordineId ? { ...o, ...updates } as Ordine : o))

      const prodottiScalati = (ordine?.righe ?? [])
        .filter(r => {
          const qty = (r as OrdineRigaConRicevuta).quantita_ricevuta != null
            ? (r as OrdineRigaConRicevuta).quantita_ricevuta as number
            : ordine?.stato === 'ricevuto' ? r.quantita_ordinata : 0
          return qty > 0 && r.magazzino_id
        })
        .map(r => {
          const qty = (r as OrdineRigaConRicevuta).quantita_ricevuta != null
            ? (r as OrdineRigaConRicevuta).quantita_ricevuta as number
            : r.quantita_ordinata
          return `${r.prodotto_nome}: -${qty} ${r.unita ?? 'pz'}`
        })

      const azioneLabel = ordine?.stato === 'ricevuto'
        ? `Ricezione annullata: ${ordine.fornitore_nome}`
        : `Ordine annullato: ${ordine?.fornitore_nome ?? ''}`
      await logActivity(
        userId, userNome,
        azioneLabel,
        prodottiScalati.length > 0
          ? `Scalato dal magazzino — ${prodottiScalati.join(', ')}`
          : undefined,
        'magazzino'
      )
    }

    setLoading(null)
    setAnnullaModal(null)
    setAnnullaNote('')
    setAnnullaSaving(false)
    router.refresh()
  }

  async function apriNuovoOrdine() {
    setNuovoModal(true)
    setNuovoFornitore('')
    setNuovoCanale('whatsapp')
    setNuovoRighe([{ magazzino_id: '', prodotto_nome: '', quantita: 1, unita: 'pz' }])
    setNuovoNote('')
    if (!magazzinoLoaded) {
      const { data } = await supabase
        .from('magazzino')
        .select('id, prodotto, unita, azienda')
        .order('prodotto', { ascending: true })
      if (data) {
        setMagazzino(data as MagazzinoItem[])
        setMagazzinoLoaded(true)
      }
    }
  }

  function aggiungiRiga() {
    setNuovoRighe(prev => [...prev, { magazzino_id: '', prodotto_nome: '', quantita: 1, unita: 'pz' }])
  }

  function rimuoviRiga(idx: number) {
    setNuovoRighe(prev => prev.filter((_, i) => i !== idx))
  }

  function aggiornaRiga(idx: number, field: keyof NuovaRiga, value: string | number) {
    setNuovoRighe(prev => prev.map((r, i) => {
      if (i !== idx) return r
      if (field === 'magazzino_id' && typeof value === 'string') {
        const item = magazzino.find(m => m.id === value)
        return {
          ...r,
          magazzino_id: value,
          prodotto_nome: item?.prodotto ?? r.prodotto_nome,
          unita: item?.unita ?? r.unita,
        }
      }
      return { ...r, [field]: value }
    }))
  }

  async function creaNuovoOrdine() {
    if (nuovoSaving) return // guard doppio-click: era la fonte principale dei duplicati
    if (!nuovoFornitore.trim()) return
    const righeValide = nuovoRighe.filter(r => r.prodotto_nome.trim() && r.quantita > 0)
    if (righeValide.length === 0) return

    setNuovoSaving(true)

    // Usa API route (admin client server-side, bypassa RLS)
    const res = await fetch('/api/ordini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fornitore_nome: nuovoFornitore.trim(),
        canale: nuovoCanale,
        note: nuovoNote.trim() || null,
        righe: righeValide.map(r => ({
          magazzino_id: r.magazzino_id || null,
          prodotto_nome: r.prodotto_nome.trim(),
          quantita_ordinata: r.quantita,
          unita: r.unita || 'pz',
        })),
      }),
    })

    if (!res.ok) {
      setNuovoSaving(false)
      return
    }

    const { ordine: nuovoOrdine } = await res.json()

    setOrdini(prev => [nuovoOrdine, ...prev])

    const prodottiOrdinati = righeValide.map(r => `${r.prodotto_nome}: ${r.quantita} ${r.unita}`).join(', ')
    await logActivity(
      userId, userNome,
      `Nuovo ordine creato: ${nuovoFornitore.trim()}`,
      prodottiOrdinati,
      'magazzino'
    )

    setNuovoSaving(false)
    setNuovoModal(false)
  }

  // Messaggio di reinvio per un ordine già creato
  function buildReinvioMsg(ordine: Ordine) {
    const lista = (ordine.righe ?? [])
      .map(r => `- ${r.prodotto_nome} (${r.quantita_ordinata} ${r.unita ?? 'pz'})`)
      .join('\n')
    return `Buongiorno,\n\nvorrei ordinare:\n${lista}\n\nGrazie,\nRidentium`
  }

  function formatData(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const tabs: { id: Filtro; label: string; count: number }[] = [
    { id: 'tutti',     label: 'Tutti',     count: ordini.length },
    { id: 'aperti',    label: 'Aperti',    count: aperti.length },
    { id: 'ricevuti',  label: 'Ricevuti',  count: ricevuti.length },
    { id: 'annullati', label: 'Annullati', count: annullati.length },
  ]

  const CANALI = [
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={13} /> },
    { id: 'email',    label: 'Email',    icon: <Mail size={13} /> },
    { id: 'eshop',    label: 'Eshop',    icon: <Globe size={13} /> },
    { id: 'telefono', label: 'Telefono', icon: <Phone size={13} /> },
  ] as const

  return (
    <div>
      {/* Header: filtri + pulsante nuovo ordine */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setFiltro(t.id)}
              className={`text-xs px-4 py-1.5 rounded border transition-colors ${
                filtro === t.id
                  ? 'bg-gold/20 border-gold/40 text-gold'
                  : 'border-obsidian-light/40 text-stone hover:text-cream'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  filtro === t.id ? 'bg-gold/30' : 'bg-obsidian-light/40'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={apriNuovoOrdine}
          className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
        >
          <Plus size={13} /> Nuovo ordine
        </button>
      </div>

      {/* Lista ordini */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <ShoppingCart size={32} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">Nessun ordine trovato</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ordine => {
            const isExpanded = expandedId === ordine.id
            const isLoading  = loading === ordine.id
            const aperto     = ordine.stato === 'inviato' || ordine.stato === 'parziale'

            return (
              <div key={ordine.id} className="card">
                {/* Header ordine */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-medium text-cream">{ordine.fornitore_nome}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${STATO_COLOR[ordine.stato]}`}>
                        {STATO_LABEL[ordine.stato]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded border border-obsidian-light/30 text-stone flex items-center gap-1">
                        {ordine.canale === 'whatsapp' && <><MessageCircle size={9} /> WhatsApp</>}
                        {ordine.canale === 'email'    && <><Mail size={9} /> Email</>}
                        {ordine.canale === 'eshop'    && <><Globe size={9} /> Eshop</>}
                        {ordine.canale === 'telefono' && <><Phone size={9} /> Telefono</>}
                      </span>
                    </div>
                    <p className="text-xs text-stone">{formatData(ordine.data_invio)}</p>
                    {ordine.data_ricezione && (
                      <p className="text-xs text-stone/60 mt-0.5">
                        Ricevuto: {formatData(ordine.data_ricezione)}
                      </p>
                    )}
                    {ordine.note && (
                      <p className="text-xs text-stone/70 mt-1 italic">"{ordine.note}"</p>
                    )}
                  </div>
                  {/* Toggle righe */}
                  {ordine.righe && ordine.righe.length > 0 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ordine.id)}
                      className="text-stone hover:text-cream transition-colors p-1 flex-shrink-0 flex items-center gap-1"
                    >
                      <Package size={12} />
                      <span className="text-[10px]">{ordine.righe.length}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {/* Righe prodotti (espandibile) */}
                {isExpanded && ordine.righe && ordine.righe.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-obsidian-light/30 space-y-1.5">
                    {ordine.righe.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-cream/80">{r.prodotto_nome}</span>
                        <span className="text-stone text-xs">
                          {r.quantita_ordinata} {r.unita ?? 'pz'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Azioni (solo ordini aperti) */}
                {aperto && (() => {
                  const forn = fornitori.find(f => f.id === ordine.fornitore_id)
                  const msg  = buildReinvioMsg(ordine)
                  return (
                    <div className="mt-3 pt-3 border-t border-obsidian-light/30 flex gap-2 flex-wrap">
                      {/* Reinvio tramite canale originale */}
                      {ordine.canale === 'whatsapp' && forn?.telefono && (
                        <button
                          onClick={() => {
                            const phone = forn.telefono!.replace(/\D/g, '')
                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                          }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-900/30 border border-green-600/30 text-green-400 hover:bg-green-900/50 transition-colors"
                        >
                          <MessageCircle size={11} /> Reinvia WA
                        </button>
                      )}
                      {ordine.canale === 'email' && forn?.email && (
                        <button
                          onClick={() => {
                            const sub  = encodeURIComponent('Ordine - Ridentium')
                            const body = encodeURIComponent(msg)
                            window.open(`mailto:${forn.email}?subject=${sub}&body=${body}`)
                          }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors"
                        >
                          <Mail size={11} /> Reinvia email
                        </button>
                      )}
                      {ordine.canale === 'eshop' && forn?.sito_eshop && (
                        <a
                          href={forn.sito_eshop}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          <Globe size={11} /> Vai eshop
                        </a>
                      )}
                      {ordine.canale === 'telefono' && forn?.telefono && (
                        <a
                          href={`tel:${forn.telefono.replace(/\s/g, '')}`}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors"
                        >
                          <Phone size={11} /> Chiama
                        </a>
                      )}

                      <div className="flex-1" />

                      <button
                        onClick={() => apriRicezione(ordine)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                      >
                        <Check size={11} /> Ricevuto
                      </button>
                      <button
                        onClick={() => { setAnnullaModal({ ordineId: ordine.id }); setAnnullaNote(''); setAnnullaError(null) }}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <X size={11} /> Annulla
                      </button>
                    </div>
                  )
                })()}

                {/* Azione annulla ricezione (solo ordini già totalmente ricevuti) */}
                {ordine.stato === 'ricevuto' && (
                  <div className="mt-3 pt-3 border-t border-obsidian-light/30 flex gap-2 flex-wrap">
                    <button
                      onClick={() => { setAnnullaModal({ ordineId: ordine.id }); setAnnullaNote(''); setAnnullaError(null) }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                    >
                      <X size={11} /> Annulla ricezione
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal ricezione ordine */}
      {ricezioneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">

            {ricezioneStep === 'tipo' ? (
              <>
                <h2 className="text-cream font-medium mb-1">Ricezione ordine</h2>
                <p className="text-stone text-xs mb-6">
                  Ordine da <span className="text-cream">{ricezioneModal.ordine.fornitore_nome}</span> — come è stato consegnato?
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => selezionaTipo('totale')}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    <Check size={20} />
                    <span className="text-sm font-medium">Totalmente</span>
                    <span className="text-xs text-green-400/70">Tutto ricevuto</span>
                  </button>
                  <button
                    onClick={() => selezionaTipo('parziale')}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">Parzialmente</span>
                    <span className="text-xs text-blue-400/70">Solo in parte</span>
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setRicezioneModal(null)}
                    className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-cream font-medium mb-1">
                  {ricezioneTipo === 'totale' ? 'Ricezione totale' : 'Ricezione parziale'}
                </h2>
                <p className="text-stone text-xs mb-4">
                  {ricezioneTipo === 'totale'
                    ? 'Verifica le quantità — verranno aggiunte al magazzino'
                    : 'Inserisci le quantità effettivamente ricevute (0 = non consegnato)'}
                </p>

                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
                  {ricezioneModal.ordine.righe?.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-obsidian-light/20 last:border-0">
                      <span className="text-sm text-cream/80 flex-1 truncate">{r.prodotto_nome}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ricezioneTipo === 'parziale' ? (
                          <input
                            type="number"
                            min={0}
                            max={r.quantita_ordinata}
                            value={quantitaRicevute[r.id] ?? 0}
                            onChange={e => setQuantitaRicevute(prev => ({
                              ...prev,
                              [r.id]: Math.max(0, Math.min(r.quantita_ordinata, parseInt(e.target.value) || 0))
                            }))}
                            className="w-16 text-center bg-obsidian-light border border-obsidian-light/60 rounded px-2 py-1 text-cream text-xs focus:outline-none focus:border-gold/50"
                          />
                        ) : (
                          <span className="text-green-400 text-sm font-medium">{r.quantita_ordinata}</span>
                        )}
                        <span className="text-stone text-xs w-6">{r.unita ?? 'pz'}</span>
                        {ricezioneTipo === 'parziale' && (
                          <span className="text-stone/40 text-[10px] w-10">/ {r.quantita_ordinata}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <textarea
                  value={ricezioneNote}
                  onChange={e => setRicezioneNote(e.target.value)}
                  placeholder="Note (opzionale)..."
                  className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50 mb-4"
                  rows={2}
                />

                {ricezioneError && (
                  <p className="text-red-400 text-xs mb-3 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {ricezioneError}
                  </p>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setRicezioneStep('tipo')}
                    className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
                  >
                    ← Indietro
                  </button>
                  <button
                    onClick={confermaRicezione}
                    disabled={ricezioneSaving}
                    className={`text-xs px-4 py-2 rounded border transition-colors disabled:opacity-50 ${
                      ricezioneTipo === 'totale'
                        ? 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30'
                        : 'bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30'
                    }`}
                  >
                    {ricezioneSaving ? 'Salvataggio...' : 'Conferma ricezione'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal annulla ordine / annulla ricezione */}
      {annullaModal && (() => {
        const ordineTarget = ordini.find(o => o.id === annullaModal.ordineId)
        const isRicezioneAnnullata = ordineTarget?.stato === 'ricevuto' || ordineTarget?.stato === 'parziale'
        const titleLabel = (ordineTarget?.stato === 'ricevuto' || ordineTarget?.stato === 'parziale')
          ? 'Annulla ricezione'
          : 'Annulla ordine'
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-cream font-medium mb-1">{titleLabel}</h2>
            {isRicezioneAnnullata ? (
              <p className="text-orange-400/80 text-xs mb-4">
                ⚠ Le quantità aggiunte al magazzino verranno scalate. Aggiungi un motivo (opzionale).
              </p>
            ) : (
              <p className="text-stone text-xs mb-4">Motivo annullamento (opzionale)</p>
            )}
            <textarea
              value={annullaNote}
              onChange={e => setAnnullaNote(e.target.value)}
              placeholder="Note..."
              className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50 mb-4"
              rows={3}
              autoFocus
            />
            {annullaError && (
              <p className="text-red-400 text-xs mb-3 flex items-center gap-1.5">
                <AlertCircle size={12} /> {annullaError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setAnnullaModal(null); setAnnullaNote(''); setAnnullaError(null) }}
                disabled={annullaSaving}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={() => cambiaStatoAnnullato(annullaModal.ordineId, annullaNote || undefined)}
                disabled={annullaSaving}
                className={`text-xs px-4 py-2 rounded border transition-colors disabled:opacity-50 ${
                  isRicezioneAnnullata
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
                    : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {annullaSaving ? 'Salvataggio…' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Modal nuovo ordine */}
      {nuovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-cream font-medium">Nuovo ordine</h2>
              <button
                onClick={() => setNuovoModal(false)}
                className="text-stone hover:text-cream transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Fornitore */}
            <div className="mb-4">
              <label className="block text-xs text-stone mb-1.5">Fornitore</label>
              <input
                type="text"
                value={nuovoFornitore}
                onChange={e => setNuovoFornitore(e.target.value)}
                placeholder="Es. Neodent, Nobel Biocare..."
                className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold/50"
                autoFocus
              />
            </div>

            {/* Canale */}
            <div className="mb-4">
              <label className="block text-xs text-stone mb-1.5">Canale ordine</label>
              <div className="grid grid-cols-4 gap-2">
                {CANALI.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setNuovoCanale(c.id)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-xs transition-colors ${
                      nuovoCanale === c.id
                        ? 'border-gold/50 bg-gold/15 text-gold'
                        : 'border-obsidian-light/40 text-stone hover:text-cream hover:border-obsidian-light'
                    }`}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prodotti ordinati */}
            <div className="mb-4">
              <label className="block text-xs text-stone mb-1.5">Prodotti ordinati</label>
              <div className="space-y-2">
                {nuovoRighe.map((riga, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {/* Selettore prodotto */}
                    <div className="flex-1 min-w-0">
                      {magazzino.length > 0 ? (
                        <select
                          value={riga.magazzino_id}
                          onChange={e => aggiornaRiga(idx, 'magazzino_id', e.target.value)}
                          className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold/50"
                        >
                          <option value="">— Seleziona prodotto —</option>
                          {magazzino.map(m => (
                            <option key={m.id} value={m.id}>{m.prodotto}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={riga.prodotto_nome}
                          onChange={e => aggiornaRiga(idx, 'prodotto_nome', e.target.value)}
                          placeholder="Nome prodotto..."
                          className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold/50"
                        />
                      )}
                    </div>
                    {/* Quantità */}
                    <input
                      type="number"
                      min={1}
                      value={riga.quantita}
                      onChange={e => aggiornaRiga(idx, 'quantita', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-center bg-obsidian-light border border-obsidian-light/60 rounded-lg px-2 py-1.5 text-cream text-xs focus:outline-none focus:border-gold/50"
                    />
                    <span className="text-stone text-xs w-6 flex-shrink-0">{riga.unita}</span>
                    {/* Rimuovi riga */}
                    {nuovoRighe.length > 1 && (
                      <button
                        onClick={() => rimuoviRiga(idx)}
                        className="text-stone/50 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={aggiungiRiga}
                className="mt-2 flex items-center gap-1 text-xs text-stone hover:text-gold transition-colors"
              >
                <Plus size={12} /> Aggiungi prodotto
              </button>
            </div>

            {/* Note */}
            <div className="mb-5">
              <label className="block text-xs text-stone mb-1.5">Note (opzionale)</label>
              <textarea
                value={nuovoNote}
                onChange={e => setNuovoNote(e.target.value)}
                placeholder="Riferimento ordine, istruzioni di consegna..."
                className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50"
                rows={2}
              />
            </div>

            {/* Azioni */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setNuovoModal(false)}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={creaNuovoOrdine}
                disabled={nuovoSaving || !nuovoFornitore.trim() || nuovoRighe.every(r => !r.prodotto_nome.trim())}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={12} />
                {nuovoSaving ? 'Salvataggio...' : 'Crea ordine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
