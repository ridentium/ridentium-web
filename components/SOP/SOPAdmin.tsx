'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Plus, X, ChevronDown, ChevronRight, BookOpen, Pencil, Square, CheckSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Parsa contenuto SOP: - [ ] e - [x] diventano checklist items, il resto testo libero
interface ContenutoBlock {
  type: 'text' | 'check'
  content: string
  checked?: boolean
  index?: number
}

function parseContenuto(contenuto: string): ContenutoBlock[] {
  const blocks: ContenutoBlock[] = []
  let checkIndex = 0
  for (const line of contenuto.split('\n')) {
    const matchChecked = line.match(/^- \[x\] (.+)/i)
    const matchUnchecked = line.match(/^- \[ \] (.+)/)
    if (matchChecked) {
      blocks.push({ type: 'check', content: matchChecked[1], checked: true, index: checkIndex++ })
    } else if (matchUnchecked) {
      blocks.push({ type: 'check', content: matchUnchecked[1], checked: false, index: checkIndex++ })
    } else {
      blocks.push({ type: 'text', content: line })
    }
  }
  return blocks
}

function SOPContenuto({ contenuto }: { contenuto: string }) {
  const blocks = parseContenuto(contenuto)
  const hasChecklist = blocks.some(b => b.type === 'check')

  if (!hasChecklist) {
    return (
      <div className="prose-sm text-cream/80 whitespace-pre-wrap leading-relaxed text-sm">
        {contenuto}
      </div>
    )
  }

  const [checked, setChecked] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    blocks.forEach(b => { if (b.type === 'check' && b.checked) initial.add(b.index!) })
    return initial
  })

  const totalCheck = blocks.filter(b => b.type === 'check').length
  const doneCheck = checked.size

  return (
    <div className="space-y-1.5">
      {totalCheck > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1 rounded-full bg-obsidian-light/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold transition-all duration-300"
              style={{ width: `${(doneCheck / totalCheck) * 100}%` }}
            />
          </div>
          <span className="text-xs text-stone/60 flex-shrink-0">{doneCheck}/{totalCheck}</span>
        </div>
      )}
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          if (!block.content.trim()) return <div key={i} className="h-2" />
          return <p key={i} className="text-sm text-cream/80 leading-relaxed">{block.content}</p>
        }
        const isChecked = checked.has(block.index!)
        return (
          <button
            key={i}
            onClick={() => {
              setChecked(prev => {
                const next = new Set(prev)
                if (next.has(block.index!)) { next.delete(block.index!) } else { next.add(block.index!) }
                return next
              })
            }}
            className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-lg transition-colors ${
              isChecked ? 'bg-green-500/8 text-stone/60' : 'hover:bg-obsidian-light/20 text-cream/80'
            }`}
          >
            {isChecked
              ? <CheckSquare size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
              : <Square size={15} className="text-stone/40 flex-shrink-0 mt-0.5" />
            }
            <span className={`text-sm leading-relaxed ${isChecked ? 'line-through' : ''}`}>{block.content}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function SOPAdmin({ sops }: { sops: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editSop, setEditSop] = useState<any | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

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
          <p className="text-stone text-sm">Nessun protocollo ancora.</p>
          <p className="text-xs text-stone/60 mt-1">
            Suggerimento: usa <code className="text-gold/70 bg-gold/10 px-1 rounded">- [ ] Passo</code> nel contenuto per creare checklist interattive.
          </p>
        </div>
      ) : Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="card">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-4">{cat}</h3>
          <div className="space-y-2">
            {items.map((sop: any) => {
              const hasChecklist = /^- \[[ x]\] /m.test(sop.contenuto ?? '')
              return (
                <div key={sop.id} className="border border-obsidian-light rounded overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-obsidian-light/30 transition-colors"
                    onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}
                  >
                    <div className="flex items-center gap-3">
                      {expanded === sop.id
                        ? <ChevronDown size={14} className="text-gold" />
                        : <ChevronRight size={14} className="text-stone" />
                      }
                      <span className="text-sm text-cream font-medium">{sop.titolo}</span>
                      <span className="text-xs text-stone">v{sop.versione}</span>
                      {hasChecklist && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/70 border border-gold/20">
                          checklist
                        </span>
                      )}
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
                      <SOPContenuto contenuto={sop.contenuto ?? ''} />
                      <p className="text-xs text-stone mt-4 pt-3 border-t border-obsidian-light/30">
                        Visibile a: {(sop.ruoli_visibili ?? []).join(', ')}
                        {sop.autore_profilo && ` · Autore: ${sop.autore_profilo.nome} ${sop.autore_profilo.cognome}`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
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
    if (saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (sop) {
        await supabase.from('sop').update({ ...form, updated_at: new Date().toISOString() }).eq('id', sop.id)
      } else {
        await supabase.from('sop').insert({ ...form, autore: user?.id })
      }
      onSave()
    } finally {
      setSaving(false)
    }
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
            <label className="label-field block mb-1">Contenuto</label>
            <p className="text-[10px] text-stone/50 mb-1.5">
              Usa <code className="text-gold/70">- [ ] Passo</code> per creare checklist interattive
            </p>
            <textarea className="input resize-none font-mono text-xs leading-relaxed" rows={12}
              value={form.contenuto} onChange={e => set('contenuto', e.target.value)}
              placeholder={'Scrivi il protocollo passo per passo…\n\n- [ ] Primo step\n- [ ] Secondo step\n- [ ] Terzo step'} />
          </div>
          <div>
            <label className="label-field block mb-2">Visibile a</label>
            <div className="flex gap-2 flex-wrap">
              {['admin', 'aso', 'segretaria', 'manager', 'clinico'].map(r => (
                <button key={r} type="button" onClick={() => toggleRuolo(r)}
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
