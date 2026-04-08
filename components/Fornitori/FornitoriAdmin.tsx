'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fornitore, MagazzinoItem } from '@/types'
import { Plus, Trash2, MessageCircle, ShoppingCart, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  fornitori: Fornitore[]
  magazzino: MagazzinoItem[]
  currentUserId: string
  currentUserNome: string
}

export default function FornitoriAdmin({ fornitori, magazzino, currentUserId, currentUserNome }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [note, setNote] = useState('')
  const [activeTab, setActiveTab] = useState<'lista' | 'ordine'>('lista')

  // Items sotto soglia, raggruppati per fornitore (azienda)
  const alertItems = magazzino.filter(i => i.quantita < i.soglia_minima)
  const byFornitore: Record<string, MagazzinoItem[]> = {}
  alertItems.forEach(item => {
    const key = item.azienda || 'Sconosciuto'
    if (!byFornitore[key]) byFornitore[key] = []
    byFornitore[key].push(item)
  })

  function buildWhatsAppMsg(fornitoreNome: string, items: MagazzinoItem[]): string {
    const lines = items.map(i =>
      `• ${i.prodotto} — attuale: ${i.quantita} ${i.unita}, richiesta: ${i.soglia_minima} ${i.unita}`
    )
    return encodeURIComponent(
      `Buongiorno,\n\nSono lo Studio Dentistico Ridentium.\nVorrei effettuare un ordine per i seguenti prodotti:\n\n${lines.join('\n')}\n\nGrazie.`
    )
  }

  function getFornitorePhone(nome: string): string | null {
    const f = fornitori.find(f => f.nome.toLowerCase() === nome.toLowerCase())
    return f?.telefono ?? null
  }

  async function addFornitore() {
    if (!nome.trim() || !telefono.trim()) return
    await supabase.from('fornitori').insert({ nome: nome.trim(), telefono: telefono.trim(), note: note.trim() || null })
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: 'Fornitore aggiunto', dettaglio: nome, categoria: 'staff'
    })
    setNome(''); setTelefono(''); setNote('')
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function deleteFornitore(f: Fornitore) {
    if (!confirm(`Eliminare il fornitore "${f.nome}"?`)) return
    await supabase.from('fornitori').delete().eq('id', f.id)
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: 'Fornitore eliminato', dettaglio: f.nome, categoria: 'staff'
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['lista', 'ordine'] as const).map(tab => (
          <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs px-4 py-2 rounded border transition-colors ${
                    activeTab === tab
                      ? 'bg-gold text-obsidian border-gold'
                      : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  }`}>
            {tab === 'lista' ? '📋 Rubrica Fornitori' : `🛒 Ordini WhatsApp${alertItems.length > 0 ? ` (${Object.keys(byFornitore).length})` : ''}`}
          </button>
        ))}
        {activeTab === 'lista' && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-xs ml-auto">
            <Plus size={13} /> Aggiungi fornitore
          </button>
        )}
      </div>

      {/* Tab: Lista fornitori */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          {showForm && (
            <div className="card space-y-3">
              <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Nuovo fornitore</h3>
              <input className="input" placeholder="Nome fornitore" value={nome} onChange={e => setNome(e.target.value)} />
              <input className="input" placeholder="Telefono (es. +39 333 1234567)" value={telefono} onChange={e => setTelefono(e.target.value)} />
              <input className="input" placeholder="Note (opzionale)" value={note} onChange={e => setNote(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={addFornitore} className="btn-primary text-xs">Salva</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Annulla</button>
              </div>
            </div>
          )}

          {fornitori.length === 0 ? (
            <div className="card text-center py-10">
              <Phone size={24} className="text-stone mx-auto mb-3" />
              <p className="text-stone text-sm">Nessun fornitore configurato</p>
              <p className="text-stone/60 text-xs mt-1">Aggiungi i tuoi fornitori per usare la funzione ordini via WhatsApp</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              {fornitori.map(f => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-4 border-b border-obsidian-light/40 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-sm font-medium text-[#25D366] flex-shrink-0">
                    {f.nome[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream">{f.nome}</p>
                    <p className="text-xs text-stone">{f.telefono}</p>
                    {f.note && <p className="text-xs text-stone/60 mt-0.5 italic">{f.note}</p>}
                  </div>
                  <a href={`https://wa.me/${f.telefono.replace(/[^0-9+]/g, '')}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25 transition-colors">
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                  <button onClick={() => deleteFornitore(f)}
                          className="p-1.5 rounded text-stone hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Ordini WhatsApp */}
      {activeTab === 'ordine' && (
        <div className="space-y-4">
          {alertItems.length === 0 ? (
            <div className="card text-center py-10">
              <ShoppingCart size={24} className="text-stone mx-auto mb-3" />
              <p className="text-green-400 font-medium text-sm">Tutto in ordine — nessun prodotto da riordinare!</p>
            </div>
          ) : (
            Object.entries(byFornitore).map(([nomeFornitore, items]) => {
              const phone = getFornitorePhone(nomeFornitore)
              const msg = buildWhatsAppMsg(nomeFornitore, items)
              return (
                <div key={nomeFornitore} className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-cream">{nomeFornitore}</h3>
                    {phone ? (
                      <a href={`https://wa.me/${phone.replace(/[^0-9+]/g, '')}?text=${msg}`}
                         target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-2 text-xs px-4 py-2 rounded bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors font-medium">
                        <MessageCircle size={13} /> Ordina via WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-stone italic">Numero non in rubrica</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-obsidian-light/30 last:border-0">
                        <span className="text-sm text-cream/80">{item.prodotto}</span>
                        <span className="badge-alert text-xs">{item.quantita}/{item.soglia_minima} {item.unita}</span>
                      </div>
                    ))}
                  </div>
                  {/* Preview messaggio */}
                  <div className="rounded bg-[#e7fbe6] border-l-4 border-[#25D366] p-3 mt-2">
                    <p className="text-xs font-medium text-[#1a4a1f] mb-1">Anteprima messaggio:</p>
                    <pre className="text-xs font-mono text-[#1a4a1f] whitespace-pre-wrap leading-relaxed">
{`Buongiorno,

Studio Dentistico Ridentium.
Ordine per:

${items.map(i => `• ${i.prodotto} — qta: ${i.soglia_minima} ${i.unita}`).join('\n')}

Grazie.`}
                    </pre>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
