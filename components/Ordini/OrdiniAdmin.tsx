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
  const [noteModal, setNoteModal] = useState<{
    ordineId: string
    tipo: 'ricevuto' | 'parziale' | 'annullato'
  } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const aperti    = ordini.filter(o => o.stato === 'inviato' || o.stato === 'parziale')
  const ricevuti  = ordini.filter(o => o.stato === 'ricevuto')
  const annullati = ordini.filter(o => o.stato === 'annullato')

  const filtered = filtro === 'tutti'     ? ordini
    : filtro === 'aperti'    ? aperti
    : filtro === 'ricevuti'  ? ricevuti
    : annullati

  async function cambiaStato(
    ordineId: string,
    nuovoStato: 'ricevuto' | 'parziale' | 'annullato',
    note?: string
  ) {
    setLoading(ordineId)
    const updates: Record<string, unknown> = { stato: nuovoStato, note: note || null }
    if (nuovoStato === 'ricevuto' || nuovoStato === 'parziale') {
      updates.data_ricezione = new Date().toISOString()
    }
    const { error } = await supabase.from('ordini').update(updates).eq('id', ordineId)
    if (!error) {
      setOrdini(prev => prev.map(o => o.id === ordineId ? { ...o, ...updates } as Ordine : o))
      const ordine = ordini.find(o => o.id === ordineId)
      await logActivity(
        userId, userNome,
        `Ordine ${STATO_LABEL[nuovoStato].toLowerCase()}`,
        ordine?.fornitore_nome,
        'magazzino'
      )
    }
    setLoading(null)
    setNoteModal(null)
    setNoteText('')
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
                      onClick={() => { setNoteModal({ ordineId: ordine.id, tipo: 'ricevuto' }); setNoteText('') }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      <Check size={11} /> Ricevuto
                    </button>
                    <button
                      onClick={() => { setNoteModal({ ordineId: ordine.id, tipo: 'parziale' }); setNoteText('') }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    >
                      <AlertCircle size={11} /> Parziale
                    </button>
                    <button
                      onClick={() => { setNoteModal({ ordineId: ordine.id, tipo: 'annullato' }); setNoteText('') }}
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

      {/* Modal conferma stato */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-obsidian border border-obsidian-light rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-cream font-medium mb-1">
              {noteModal.tipo === 'ricevuto'  ? 'Segna come ricevuto' :
               noteModal.tipo === 'parziale'  ? 'Ricezione parziale'  : 'Annulla ordine'}
            </h2>
            <p className="text-stone text-xs mb-4">
              {noteModal.tipo === 'parziale'
                ? 'Indica cosa è stato ricevuto parzialmente'
                : noteModal.tipo === 'annullato'
                ? 'Motivo annullamento (opzionale)'
                : 'Note sulla ricezione (opzionale)'}
            </p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Note..."
              className="w-full bg-obsidian-light border border-obsidian-light/60 rounded-lg px-3 py-2 text-cream text-sm resize-none focus:outline-none focus:border-gold/50 mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setNoteModal(null); setNoteText('') }}
                className="text-xs px-4 py-2 rounded border border-obsidian-light text-stone hover:text-cream transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => cambiaStato(noteModal.ordineId, noteModal.tipo, noteText || undefined)}
                className={`text-xs px-4 py-2 rounded border transition-colors ${
                  noteModal.tipo === 'ricevuto'
                    ? 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30'
                    : noteModal.tipo === 'parziale'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30'
                    : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                }`}
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
