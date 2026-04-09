'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fornitore, MagazzinoItem } from '@/types'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Plus, Pencil, X, AlertCircle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'

const CATEGORIE = [
  'Tutte', 'Impianti', 'Componentistica Protesica', 'Materiali Chirurgici',
  'Consumabili', 'Compositi & Cementi', 'Endodonzia', 'Igiene & Profilassi',
  'DPI & Sterilizzazione'
]

interface Props {
  items: MagazzinoItem[]
  riordini: any[]
  fornitori?: Fornitore[]
  userId?: string
  userNome?: string
}

export default function MagazzinoAdmin({ items, riordini, fornitori = [], userId = '', userNome = '' }: Props) {
  const [categoria, setCategoria] = useState('Tutte')
  const [soloAlert, setSoloAlert] = useState(false)
  const [editItem, setEditItem] = useState<MagazzinoItem | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const filtered = items.filter(item => {
    if (categoria !== 'Tutte' && item.categoria !== categoria) return false
    if (soloAlert && item.quantita >= item.soglia_minima) return false
    return true
  })

  const alertCount = items.filter(i => i.quantita < i.soglia_minima).length
  const hasImpianti = filtered.some(i => i.categoria === 'Impianti')

  async function saveQuantita(id: string, nuovaQuantita: number) {
    const item = items.find(i => i.id === id)
    const { error } = await supabase.from('magazzino').update({ quantita: nuovaQuantita }).eq('id', id)
    if (!error) {
      await logActivity(userId, userNome, 'Quantità aggiornata', `${item?.prodotto ?? id}: ${nuovaQuantita} ${item?.unita ?? ''}`, 'magazzino')
      startTransition(() => router.refresh())
    }
  }

  async function evadiRiordine(riordineId: string) {
    const { error } = await supabase.from('riordini').update({ stato: 'evasa' }).eq('id', riordineId)
    if (!error) {
      await logActivity(userId, userNome, 'Riordine evaso', riordineId, 'magazzino')
      startTransition(() => router.refresh())
    }
  }

  return (
    <div className="space-y-6">
      {riordini.length > 0 && (
        <div className="card border-gold/30 bg-gold/5">
          <h3 className="text-xs uppercase tracking-widest text-gold mb-3">
            Richieste di Riordino ({riordini.length})
          </h3>
          <div className="space-y-2">
            {riordini.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-obsidian-light/30 last:border-0">
                <div>
                  <p className="text-sm text-cream">{r.magazzino_id}</p>
                  <p className="text-xs text-stone">
                    da {r.profili?.nome} {r.profili?.cognome} · {formatDate(r.created_at)}
                  </p>
                  {r.note && <p className="text-xs text-stone/70 italic mt-0.5">{r.note}</p>}
                </div>
                <button onClick={() => evadiRiordine(r.id)} className="btn-primary text-xs py-1.5 px-3">
                  Evadi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIE.map(cat => (
            <button key={cat} onClick={() => setCategoria(cat)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                categoria === cat
                  ? 'bg-gold text-obsidian border-gold'
                  : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
              }`}>
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSoloAlert(!soloAlert)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ml-auto ${
            soloAlert ? 'bg-red-400/10 text-red-400 border-red-400/30' : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
          }`}>
          <AlertTriangle size={11} /> Solo alert ({alertCount})
        </button>
        <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-ridentium">
          <thead>
            <tr>
              <th>Prodotto</th><th>Categoria</th><th>Azienda</th>
              {hasImpianti && <><th>Diametro</th><th>Lunghezza</th></>}
              <th>Qtà</th><th>Min.</th><th>Stato</th><th>Scadenza</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={hasImpianti ? 10 : 8} className="text-center text-stone py-8">Nessun prodotto trovato</td></tr>
            ) : filtered.map(item => {
              const isAlert = item.quantita < item.soglia_minima
              return (
                <tr key={item.id} className={isAlert ? 'bg-red-400/5' : ''}>
                  <td className="font-medium text-cream">{item.prodotto}</td>
                  <td>{item.categoria}</td>
                  <td>{item.azienda ?? '—'}</td>
                  {hasImpianti && (
                    <>
                      <td>{item.diametro ? `ø${item.diametro}` : '—'}</td>
                      <td>{item.lunghezza ? `${item.lunghezza}mm` : '—'}</td>
                    </>
                  )}
                  <td>
                    <QuantitaEditor value={item.quantita} onChange={val => saveQuantita(item.id, val)} />
                  </td>
                  <td className="text-stone">{item.soglia_minima}</td>
                  <td>
                    {isAlert
                      ? <span className="badge-alert"><AlertTriangle size={10} /> Sotto soglia</span>
                      : <span className="badge-ok"><CheckCircle size={10} /> OK</span>
                    }
                  </td>
                  <td className={item.scadenza && new Date(item.scadenza) < new Date() ? 'text-red-400' : ''}>
                    {formatDate(item.scadenza)}
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

      {(editItem || showAddForm) && (
        <ItemModal
          item={editItem}
          fornitori={fornitori}
          userId={userId}
          userNome={userNome}
          onClose={() => { setEditItem(null); setShowAddForm(false) }}
          onSave={() => {
            setEditItem(null)
            setShowAddForm(false)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}

function QuantitaEditor({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-cream hover:text-gold transition-colors font-medium">
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

function ItemModal({
  item, fornitori, userId, userNome, onClose, onSave
}: {
  item: MagazzinoItem | null
  fornitori: Fornitore[]
  userId: string
  userNome: string
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState<Partial<MagazzinoItem>>(item ?? {
    prodotto: '', categoria: 'Impianti', azienda: '', quantita: 0, soglia_minima: 2, unita: 'pz'
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const isImpianto = form.categoria === 'Impianti'

  function handleFornitoreChange(fornitoreId: string) {
    set('fornitore_id', fornitoreId || null)
    if (fornitoreId) {
      const f = fornitori.find(f => f.id === fornitoreId)
      if (f) set('azienda', f.nome)
    }
  }

  async function handleSave() {
    if (!form.prodotto?.trim()) { setError('Il nome del prodotto è obbligatorio.'); return }
    setSaving(true)
    setError(null)
    const data = { ...form }
    if (!isImpianto) { data.diametro = undefined; data.lunghezza = undefined }
    let dbError: any = null
    if (item) {
      const { error } = await supabase.from('magazzino').update(data).eq('id', item.id)
      dbError = error
      if (!dbError) await logActivity(userId, userNome, 'Prodotto modificato', form.prodotto, 'magazzino')
    } else {
      const { error } = await supabase.from('magazzino').insert(data)
      dbError = error
      if (!dbError) await logActivity(userId, userNome, 'Prodotto aggiunto', form.prodotto, 'magazzino')
    }
    setSaving(false)
    if (dbError) { setError('Errore nel salvataggio: ' + dbError.message); return }
    onSave()
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm(`Eliminare "${item.prodotto}" dal magazzino? Questa azione non può essere annullata.`)) return
    setDeleting(true)
    const { error } = await supabase.from('magazzino').delete().eq('id', item.id)
    if (error) { setError('Errore eliminazione: ' + error.message); setDeleting(false); return }
    await logActivity(userId, userNome, 'Prodotto eliminato', item.prodotto, 'magazzino')
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">{item ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        {error && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded bg-alert/10 border border-alert/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

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
            <label className="label-field block mb-1.5">Fornitore</label>
            <select className="input" value={form.fornitore_id ?? ''} onChange={e => handleFornitoreChange(e.target.value)}>
              <option value="">{fornitori.length === 0 ? '— nessun fornitore —' : '— seleziona —'}</option>
              {fornitori.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label-field block mb-1.5">
              Azienda{form.fornitore_id ? ' (da fornitore)' : ''}
            </label>
            <input
              className="input"
              value={form.azienda ?? ''}
              onChange={e => set('azienda', e.target.value)}
              placeholder={form.fornitore_id ? '' : 'Nome azienda'}
            />
          </div>
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
          {isImpianto && (
            <>
              <div>
                <label className="label-field block mb-1.5">Diametro (mm)</label>
                <input type="number" step="0.1" className="input" value={form.diametro ?? ''}
                  onChange={e => set('diametro', e.target.value ? +e.target.value : null)} />
              </div>
              <div>
                <label className="label-field block mb-1.5">Lunghezza (mm)</label>
                <input type="number" step="0.5" className="input" value={form.lunghezza ?? ''}
                  onChange={e => set('lunghezza', e.target.value ? +e.target.value : null)} />
              </div>
            </>
          )}
          <div>
            <label className="label-field block mb-1.5">Scadenza</label>
            <input type="date" className="input" value={form.scadenza ?? ''} onChange={e => set('scadenza', e.target.value || null)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Prezzo Unitario (€)</label>
            <input type="number" step="0.01" className="input" value={form.prezzo_unitario ?? ''}
              onChange={e => set('prezzo_unitario', e.target.value ? +e.target.value : null)} />
          </div>
          <div className="col-span-2">
            <label className="label-field block mb-1.5">Note</label>
            <textarea className="input resize-none" rows={2} value={form.note ?? ''} onChange={e => set('note', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {item && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 text-red-400 hover:bg-red-400/10 border border-red-400/30 rounded transition-colors disabled:opacity-50"
              title="Elimina prodotto">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
