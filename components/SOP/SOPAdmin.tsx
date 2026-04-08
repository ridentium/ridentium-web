'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SOP } from '@/types'
import { formatDate } from '@/lib/utils'
import { Plus, X, ChevronDown, ChevronRight, BookOpen, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SOPAdmin({ sops }: { sops: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editSop, setEditSop] = useState<any | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Raggruppa per categoria
  const grouped = sops.reduce((acc: Record<string, any[]>, sop) => {
    const cat = sop.categoria ?? 'Altro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(sop)
    return acc
  }, {})

  async function deleteSop(id: string) {
    if (!confirm('Eliminare questa SOP?')) return
    await supabase.from('sop').delete().eq('id', id)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Nuova SOP
        </button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen size={24} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">Nessun protocollo ancora. Creane uno.</p>
        </div>
      ) : Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="card">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-4">{cat}</h3>
          <div className="space-y-2">
            {items.map((sop: any) => (
              <div key={sop.id} className="border border-obsidian-light rounded overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-obsidian-light/30 transition-colors"
                     onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}>
                  <div className="flex items-center gap-3">
                    {expanded === sop.id ? <ChevronDown size={14} className="text-gold" /> : <ChevronRight size={14} className="text-stone" />}
                    <span className="text-sm text-cream font-medium">{sop.titolo}</span>
                    <span className="text-xs text-stone">v{sop.versione}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone">{formatDate(sop.updated_at)}</span>
                    <button onClick={e => { e.stopPropagation(); setEditSop(sop) }} className="btn-ghost p-1">
                      <Pencil size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteSop(sop.id) }} className="btn-ghost p-1 hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                </div>
                {expanded === sop.id && (
                  <div className="px-4 py-4 border-t border-obsidian-light bg-obsidian/50">
                    <div className="prose-sm text-cream/80 whitespace-pre-wrap leading-relaxed text-sm">
                      {sop.contenuto}
                    </div>
                    <p className="text-xs text-stone mt-4">
                      Visibile a: {(sop.ruoli_visibili ?? []).join(', ')}
                      {sop.autore_profilo && ` · Autore: ${sop.autore_profilo.nome} ${sop.autore_profilo.cognome}`}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {(showForm || editSop) && (
        <SOPModal
          sop={editSop}
          onClose={() => { setShowForm(false); setEditSop(null) }}
          onSave={() => { setShowForm(false); setEditSop(null); startTransition(() => router.refresh()) }}
        />
      )}
    </div>
  )
}

function SOPModal({ sop, onClose, onSave }: { sop: any | null; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    titolo: sop?.titolo ?? '',
    categoria: sop?.categoria ?? 'Clinico',
    contenuto: sop?.contenuto ?? '',
    versione: sop?.versione ?? '1.0',
    ruoli_visibili: sop?.ruoli_visibili ?? ['admin', 'aso', 'segretaria', 'manager'],
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function toggleRuolo(ruolo: string) {
    const current = form.ruoli_visibili as string[]
    set('ruoli_visibili', current.includes(ruolo)
      ? current.filter(r => r !== ruolo)
      : [...current, ruolo])
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (sop) {
      await supabase.from('sop').update(form).eq('id', sop.id)
    } else {
      await supabase.from('sop').insert({ ...form, autore: user?.id })
    }
    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">{sop ? 'Modifica SOP' : 'Nuova SOP'}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-field block mb-1.5">Titolo *</label>
              <input className="input" value={form.titolo} onChange={e => set('titolo', e.target.value)} />
            </div>
            <div>
              <label className="label-field block mb-1.5">Categoria</label>
              <input className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)}
                     placeholder="es. Clinico, Accettazione…" />
            </div>
            <div>
              <label className="label-field block mb-1.5">Versione</label>
              <input className="input" value={form.versione} onChange={e => set('versione', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-field block mb-1.5">Contenuto</label>
            <textarea className="input resize-none font-mono text-xs leading-relaxed" rows={12}
                      value={form.contenuto} onChange={e => set('contenuto', e.target.value)}
                      placeholder="Scrivi il protocollo passo per passo…" />
          </div>
          <div>
            <label className="label-field block mb-2">Visibile a</label>
            <div className="flex gap-2 flex-wrap">
              {['admin','aso','segretaria','manager'].map(r => (
                <button key={r} type="button"
                        onClick={() => toggleRuolo(r)}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                          (form.ruoli_visibili as string[]).includes(r)
                            ? 'bg-gold/10 text-gold border-gold/30'
                            : 'border-obsidian-light text-stone'
                        }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleSave} disabled={saving || !form.titolo} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
