'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ordine } from '@/types'
import { logActivity } from '@/lib/registro'
import {
  MessageCircle, Mail, Check, X, AlertCircle,
  Package, ChevronDown, ChevronUp, ShoppingCart
} from 'lucide-react'

interface Props {
  ordini: Ordine[]
  userId: string
  userNome: string
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

export default function OrdiniAdmin({ ordini: initialOrdini, userId, userNome }: Props) {
  const supabase = createClient()
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

  // Modal annulla
  const [annullaModal, setAnnullaModal] = useState<{ ordineId: string } | null>(null)
  const [annullaNote, setAnnullaNote] = useState('')

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
    setRicezioneSaving(true)

    // 1. Aggiorna quantità magazzino per ogni riga ricevuta
    for (const riga of (ricezioneModal.ordine.righe ?? [])) {
      const qty = quantitaRicevute[riga.id] ?? 0
      if (qty > 0 && riga.magazzino_id) {
        const { data: item } = await supabase
          .from('magazzino').select('quantita').eq('id', riga.magazzino_id).single()
        if (item) {
          await supabase.from('magazzino')
            .update({ quantita: (item.quantita ?? 0) + qty })
            .eq('id', riga.magazzino_id)
        }
      }
    }

    // 2. Aggiorna stato ordine
    const nuovoStato = ricezioneTipo === 'totale' ? 'ricevuto' : 'parziale'
    setLoading(ricezioneModal.ordine.id)
    const updates: Record<string, unknown> = {
      stato: nuovoStato,
      note: ricezioneNote || null,
      data_ricezione: new Date().toISOString(),
    }
    const { error } = await supabase.from('ordini').update(updates).eq('id', ricezioneModal.ordine.id)
    if (!error) {
      const ordineId = ricezioneModal.ordine.id
      setOrdini(prev => prev.map(o => o.id === ordineId ? { ...o, ...updates } as Ordine : o))
      await logActivity(
        userId, userNome,
        `Ordine ${STATO_LABEL[nuovoStato].toLowerCase()}`,
        ricezioneModal.ordine.fornitore_nome,
        'magazzino'
      )
    }
    setLoading(null)
    setRicezioneModal(null)
    setRicezioneSaving(false)
  }

  async function cambiaStatoAnnullato(ordineId: string, note?: string) {
    setLoading(ordineId)
    const updates = { stato: 'annullato', note: note || null }
    const { error } = await supabase.from('ordini').update(updates).eq('id', ordineId)
    if (!error) {
      setOrdini(prev => prev.map(o => o.id === ordineId ? { ...o, ...updates } as Ordine : o))
      const ordine = ordini.find(o => o.id === ordineId)
      await logActivity(userId, userNome, 'Ordine annullato', ordine?.fornitore_nome, 'magazzino')
    }
    setLoading(null)
    setAnnullaModal(null)
    setAnnullaNote('')
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

  return (
    <div>
      {/* Filtri */}
      <div className="flex gap-2 mb-6 flex-wrap">
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
                        {ordine.canale === 'whatsapp'
                          ? <><MessageCircle size={9} /> WhatsApp</>
                          : <><Mail size={9} /> Email</>
                        }
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
                {aperto && (
                  <div className="mt-3 pt-3 border-t border-obsidian-light/30 flex gap-2 flex-wrap">
                    <button
                      onClick={() => apriRicezione(ordine)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      <Check size={11} /> Ricevuto
                    </button>
                    <button
                      onClick={() => { setAnnullaModal({ ordineId: ordine.id }); setAnnullaNote('') }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <X size={11} /> Annulla
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

      {/* Modal annulla ordine */}
      {annullaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-cream font-medium mb-1">Annulla ordine</h2>
            <p className="text-stone text-xs mb-4">Motivo annullamento (opzionale)</p>
            <textarea
              value={annullaNote}
              onChange={e => setAnnullaNote(e.target.value)}
              placeholder="Note..."
              className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50 mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setAnnullaModal(null); setAnnullaNote('') }}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => cambiaStatoAnnullato(annullaModal.ordineId, annullaNote || undefined)}
                className="text-xs px-4 py-2 rounded border bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
