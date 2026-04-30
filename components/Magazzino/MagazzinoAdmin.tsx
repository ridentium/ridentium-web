'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MagazzinoItem, Fornitore } from '@/types'
import { formatDate } from '@/lib/utils'
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ChevronsUpDown, Plus, Pencil, Search, X, Zap
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import SottoSogliaOrdina from '@/components/Dashboard/SottoSogliaOrdina'

const CATEGORIE = [
  'Tutte', 'Impianti', 'Componentistica Protesica', 'Materiali Chirurgici',
  'Consumabili', 'Compositi & Cementi', 'Endodonzia',
  'Igiene & Profilassi', 'DPI & Sterilizzazione'
]

type SortField = 'prodotto' | 'categoria' | 'azienda' | 'diametro' | 'lunghezza' | 'quantita' | 'scadenza'
type SortDir = 'asc' | 'desc'

interface Props {
  items: MagazzinoItem[]
  riordini: any[]
  fornitori?: Fornitore[]
  userId?: string
  userNome?: string
  /** IDs magazzino già presenti in ordini aperti (server-side) */
  orderedItemIds?: string[]
}

interface ItemModalProps {
  item: MagazzinoItem | null
  fornitori: Fornitore[]
  onClose: () => void
  onSave: (updated?: MagazzinoItem) => void
}

interface EvadisciModalState {
  riordineId: string
  magazzinoId: string
  prodotto: string
  unitaMisura: string
  quantitaAttuale: number
}

export default function MagazzinoAdmin({ items: itemsProp, riordini, fornitori = [], userId = '', userNome = '', orderedItemIds = [] }: Props) {
  const [items, setItems] = useState<MagazzinoItem[]>(itemsProp)
  const [categoria, setCategoria] = useState('Tutte')
  const [evadisciModal, setEvadisciModal] = useState<EvadisciModalState | null>(null)
  // Se l'URL contiene ?filter=alert (es. da tap su "19 sotto soglia" nel dashboard),
  // la pagina apre già filtrata sui prodotti sotto soglia.
  const initialSoloAlert = typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('filter') === 'alert'
  const [soloAlert, setSoloAlert] = useState(initialSoloAlert)
  const [cerca, setCerca] = useState('')
  const [sortField, setSortField] = useState<SortField>('prodotto')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [editItem, setEditItem] = useState<MagazzinoItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showOrdineRapido, setShowOrdineRapido] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown size={11} className="text-stone/40 inline ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-gold inline ml-1" />
      : <ChevronDown size={11} className="text-gold inline ml-1" />
  }

  const filtered = items
    .filter(item => {
      if (categoria !== 'Tutte' && item.categoria !== categoria) return false
      if (soloAlert && item.quantita >= item.soglia_minima) return false
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

  const alertItems = items.filter(i => i.quantita < i.soglia_minima)
  const alertCount = alertItems.length

  async function saveQuantita(id: string, nuovaQuantita: number) {
    const item = items.find(i => i.id === id)
    const eraOk = item ? item.quantita >= item.soglia_minima : true
    const saraAlert = item ? nuovaQuantita < item.soglia_minima : false

    setItems(prev => prev.map(i => i.id === id ? { ...i, quantita: nuovaQuantita } : i))
    await supabase.from('magazzino').update({ quantita: nuovaQuantita }).eq('id', id)

    // Notifica soglia solo quando si PASSA da ok → alert (non ad ogni modifica sotto soglia)
    if (eraOk && saraAlert && item) {
      fetch('/api/magazzino/check-soglia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, prodotto: item.prodotto, quantita: nuovaQuantita, soglia_minima: item.soglia_minima }),
      }).catch(() => {})
    }
  }

  function apriEvadisci(riordine: any) {
    const item = items.find(i => i.id === riordine.magazzino_id)
    setEvadisciModal({
      riordineId: riordine.id,
      magazzinoId: riordine.magazzino_id,
      prodotto: item?.prodotto ?? riordine.magazzino?.prodotto ?? 'Prodotto',
      unitaMisura: item?.unita ?? 'pz',
      quantitaAttuale: item?.quantita ?? 0,
    })
  }

  async function confermaEvadisci(qtyRicevuta: number) {
    if (!evadisciModal) return
    const nuovaQty = evadisciModal.quantitaAttuale + qtyRicevuta
    await Promise.all([
      supabase.from('riordini').update({ stato: 'evasa' }).eq('id', evadisciModal.riordineId),
      supabase.from('magazzino').update({ quantita: nuovaQty, updated_at: new Date().toISOString() }).eq('id', evadisciModal.magazzinoId),
    ])
    setItems(prev => prev.map(i =>
      i.id === evadisciModal.magazzinoId ? { ...i, quantita: nuovaQty } : i
    ))
    setEvadisciModal(null)
    startTransition(() => router.refresh())
  }

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
                <div key={r.id} className="flex items-center justify-between py-2.5
                                            border-b border-obsidian-light/30 last:border-0">
                  <div>
                    <p className="text-sm text-cream font-medium">{prodotto}</p>
                    <p className="text-xs text-stone mt-0.5">
                      da {r.profili?.nome} {r.profili?.cognome} · {formatDate(r.created_at)}
                    </p>
                    {r.note && <p className="text-xs text-stone/70 italic mt-0.5">"{r.note}"</p>}
                  </div>
                  <button onClick={() => apriEvadisci(r)}
                          className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    Merce arrivata
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ordine Rapido (collassabile) — mostra tutti i prodotti sotto soglia */}
      {alertItems.length > 0 && (
        <div className="card border-gold/20">
          <button
            onClick={() => setShowOrdineRapido(v => !v)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-gold" />
              <h3 className="text-xs uppercase tracking-widest text-gold">
                Ordine Rapido — {alertItems.length} prodott{alertItems.length === 1 ? 'o' : 'i'} sotto soglia
              </h3>
            </div>
            {showOrdineRapido
              ? <ChevronUp size={14} className="text-stone" />
              : <ChevronDown size={14} className="text-stone" />
            }
          </button>
          {showOrdineRapido && (
            <div className="mt-4">
              <SottoSogliaOrdina
                alertItems={alertItems}
                fornitori={fornitori}
                userId={userId}
                userNome={userNome}
                orderedItemIds={orderedItemIds}
              />
            </div>
          )}
        </div>
      )}

      {/* Barra cerca + azioni */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone pointer-events-none" />
          <input
            type="text"
            placeholder="Cerca prodotto, azienda, codice…"
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            className="input pl-8 pr-8 py-2 text-sm w-full"
          />
          {cerca && (
            <button
              onClick={() => setCerca('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone hover:text-cream transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      {/* Filtri categoria — scroll orizzontale su mobile (monofila) */}
      <div className="flex items-center gap-2">
        {/* Pillole in scroll orizzontale — non wrappano mai */}
        <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-2" style={{ width: 'max-content' }}>
            {CATEGORIE.map(cat => (
              <button key={cat}
                      onClick={() => setCategoria(cat)}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors whitespace-nowrap ${
                        categoria === cat
                          ? 'bg-gold text-obsidian border-gold'
                          : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                      }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        {/* Bottone alert — fisso a destra */}
        <button onClick={() => setSoloAlert(!soloAlert)}
                className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  soloAlert
                    ? 'bg-red-400/10 text-red-400 border-red-400/30'
                    : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                }`}>
          <AlertTriangle size={11} />
          <span className="hidden sm:inline">Sotto soglia</span>
          <span className="text-xs">({alertCount})</span>
        </button>
      </div>

      {/* Risultati */}
      {cerca && (
        <p className="text-xs text-stone">
          {filtered.length} risultat{filtered.length === 1 ? 'o' : 'i'}
          {categoria !== 'Tutte' ? ` in ${categoria}` : ''}
          {' '}per <span className="text-cream">&ldquo;{cerca}&rdquo;</span>
        </p>
      )}

      {/* Tabella — scrollabile orizzontalmente su mobile/tablet */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-ridentium" style={{ minWidth: '860px' }}>
            <thead>
              <tr>
                <th>
                  <button onClick={() => toggleSort('prodotto')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    Prodotto <SortIcon field="prodotto" />
                  </button>
                </th>
                <th>
                  <button onClick={() => toggleSort('categoria')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    Categoria <SortIcon field="categoria" />
                  </button>
                </th>
                <th>
                  <button onClick={() => toggleSort('azienda')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    Azienda <SortIcon field="azienda" />
                  </button>
                </th>
                <th>
                  <button onClick={() => toggleSort('diametro')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    Ø <SortIcon field="diametro" />
                  </button>
                </th>
                <th>
                  <button onClick={() => toggleSort('lunghezza')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    L (mm) <SortIcon field="lunghezza" />
                  </button>
                </th>
                <th>
                  <button onClick={() => toggleSort('quantita')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    Qtà <SortIcon field="quantita" />
                  </button>
                </th>
                <th>Min.</th>
                <th>Stato</th>
                <th>
                  <button onClick={() => toggleSort('scadenza')} className="flex items-center gap-0.5 hover:text-cream transition-colors">
                    Scadenza <SortIcon field="scadenza" />
                  </button>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-stone py-8">
                    {cerca ? `Nessun prodotto trovato per "${cerca}"` : 'Nessun prodotto trovato'}
                  </td>
                </tr>
              ) : filtered.map(item => {
                const isAlert = item.quantita < item.soglia_minima
                return (
                  <tr key={item.id} className={isAlert ? 'bg-red-400/5' : ''}>
                    <td className="font-medium text-cream">{item.prodotto}</td>
                    <td>{item.categoria}</td>
                    <td>{item.azienda ?? '—'}</td>
                    <td>{item.diametro ? `ø${item.diametro}` : '—'}</td>
                    <td>{item.lunghezza ? `${item.lunghezza}mm` : '—'}</td>
                    <td>
                      <QuantitaEditor
                        value={item.quantita}
                        onChange={val => saveQuantita(item.id, val)}
                      />
                    </td>
                    <td className="text-stone">{item.soglia_minima}</td>
                    <td>
                      {isAlert
                        ? <span className="badge-alert"><AlertTriangle size={10} /> Sotto soglia</span>
                        : <span className="badge-ok"><CheckCircle size={10} /> OK</span>
                      }
                    </td>
                    <td className={item.scadenza && new Date(item.scadenza) < new Date() ? 'text-red-400' : ''}>
                      {formatDate(item.scadenza ?? undefined)}
                    </td>
                    <td>
                      <button onClick={() => setEditItem(item)} className="btn-ghost p-1.5">
                        <Pencil size={13} />
                      </button>
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
          prodotto={evadisciModal.prodotto}
          unitaMisura={evadisciModal.unitaMisura}
          quantitaAttuale={evadisciModal.quantitaAttuale}
          onClose={() => setEvadisciModal(null)}
          onConferma={confermaEvadisci}
        />
      )}

      {/* Modal modifica/aggiunta */}
      {(editItem || showAddForm) && (
        <ItemModal
          item={editItem}
          fornitori={fornitori}
          onClose={() => { setEditItem(null); setShowAddForm(false) }}
          onSave={(updated?: MagazzinoItem) => {
            setEditItem(null)
            setShowAddForm(false)
            if (updated) {
              setItems(prev => {
                const exists = prev.find(i => i.id === updated.id)
                return exists
                  ? prev.map(i => i.id === updated.id ? updated : i)
                  : [...prev, updated]
              })
            }
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}

function EvadisciModal({
  prodotto, unitaMisura, quantitaAttuale, onClose, onConferma,
}: {
  prodotto: string
  unitaMisura: string
  quantitaAttuale: number
  onClose: () => void
  onConferma: (qty: number) => Promise<void>
}) {
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConferma() {
    const n = Number(qty)
    if (!n || n <= 0) return
    setSaving(true)
    await onConferma(n)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-base">Merce arrivata</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <div className="mb-1">
          <p className="text-sm text-cream font-medium">{prodotto}</p>
          <p className="text-xs text-stone mt-1">
            Giacenza attuale: <span className="text-cream">{quantitaAttuale} {unitaMisura}</span>
          </p>
        </div>

        <div className="mt-4">
          <label className="label-field block mb-1.5">Quantità ricevuta ({unitaMisura})</label>
          <input
            type="number"
            min="1"
            step="1"
            className="input text-lg text-center font-medium"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConferma() }}
            placeholder="0"
            autoFocus
          />
          {qty && Number(qty) > 0 && (
            <p className="text-xs text-stone/60 mt-2 text-center">
              Nuova giacenza: <span className="text-green-400 font-medium">{quantitaAttuale + Number(qty)} {unitaMisura}</span>
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button
            onClick={handleConferma}
            disabled={!qty || Number(qty) <= 0 || saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
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
      <button onClick={() => setEditing(true)}
              className="text-cream hover:text-gold transition-colors font-medium">
        {value}
      </button>
    )
  }
  return (
    <input
      type="number"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(Number(val)); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(Number(val)); setEditing(false) } }}
      className="input w-16 py-1 text-center text-sm"
      autoFocus
    />
  )
}

function ItemModal({ item, fornitori, onClose, onSave }: ItemModalProps) {
  const supabase = createClient()
  const [form, setForm] = useState<Partial<MagazzinoItem>>(item ?? {
    prodotto: '', categoria: 'Impianti', azienda: 'Neodent',
    quantita: 0, soglia_minima: 2, unita: 'pz'
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (saving) return // guard doppio-click
    setSaving(true)
    try {
      if (item) {
        const { data } = await supabase.from('magazzino').update(form).eq('id', item.id).select().single()
        onSave(data ?? undefined)
      } else {
        const { data } = await supabase.from('magazzino').insert(form).select().single()
        onSave(data ?? undefined)
      }
    } finally {
      setSaving(false)
    }
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
            <label className="label-field block mb-1.5">Azienda</label>
            <input className="input" value={form.azienda ?? ''} onChange={e => set('azienda', e.target.value)} />
          </div>
          {fornitori.length > 0 && (
            <div className="col-span-2">
              <label className="label-field block mb-1.5">Fornitore (per riordino automatico)</label>
              <select className="input" value={form.fornitore_id ?? ''} onChange={e => set('fornitore_id', e.target.value || null)}>
                <option value="">— Nessun fornitore —</option>
                {fornitori.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
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
