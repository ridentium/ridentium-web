'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, UserProfile } from '@/types'
import { formatDate, roleLabel } from '@/lib/utils'
import { Plus, X, CheckCircle2, Circle, Clock, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

const STATI = ['da_fare', 'in_corso', 'completato'] as const
const PRIORITA = ['bassa', 'media', 'alta'] as const

const statoLabel: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completato: 'Completato'
}
const statoIcon = {
  da_fare: Circle,
  in_corso: Clock,
  completato: CheckCircle2,
}
const statoColor: Record<string, string> = {
  da_fare: 'text-stone', in_corso: 'text-gold', completato: 'text-green-400'
}
const prioritaColor: Record<string, string> = {
  bassa: 'text-stone', media: 'text-gold/70', alta: 'text-red-400'
}

export default function TasksAdmin({ tasks, staff }: { tasks: any[]; staff: UserProfile[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [filterStato, setFilterStato] = useState<string>('tutti')

  const filtered = tasks.filter(t => filterStato === 'tutti' || t.stato === filterStato)

  async function updateStato(id: string, stato: string) {
    await supabase.from('tasks').update({ stato }).eq('id', id)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">

      {/* Filtri + nuovo task */}
      <div className="flex items-center gap-3 flex-wrap">
        {['tutti', ...STATI].map(s => (
          <button key={s}
                  onClick={() => setFilterStato(s)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    filterStato === s
                      ? 'bg-gold text-obsidian border-gold'
                      : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  }`}>
            {s === 'tutti' ? 'Tutti' : statoLabel[s]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)}
                className="btn-primary ml-auto flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Nuovo task
        </button>
      </div>

      {/* Lista task */}
      <div className="card p-0 overflow-hidden">
        <table className="table-ridentium">
          <thead>
            <tr>
              <th>Stato</th>
              <th>Titolo</th>
              <th>Assegnato a</th>
              <th>Priorità</th>
              <th>Scadenza</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-stone py-8">Nessun task</td></tr>
            ) : filtered.map((task: any) => {
              const Icon = statoIcon[task.stato as keyof typeof statoIcon] ?? Circle
              return (
                <tr key={task.id} className={task.stato === 'completato' ? 'opacity-50' : ''}>
                  <td>
                    <button onClick={() => {
                      const next = task.stato === 'da_fare' ? 'in_corso'
                                 : task.stato === 'in_corso' ? 'completato' : 'da_fare'
                      updateStato(task.id, next)
                    }} className={`${statoColor[task.stato]} hover:scale-110 transition-transform`}>
                      <Icon size={16} />
                    </button>
                  </td>
                  <td>
                    <p className={`font-medium ${task.stato === 'completato' ? 'line-through text-stone' : 'text-cream'}`}>
                      {task.titolo}
                    </p>
                    {task.descrizione && (
                      <p className="text-xs text-stone mt-0.5 truncate max-w-xs">{task.descrizione}</p>
                    )}
                  </td>
                  <td>
                    {task.assegnato_a_profilo
                      ? `${task.assegnato_a_profilo.nome} ${task.assegnato_a_profilo.cognome}`
                      : <span className="text-stone">—</span>}
                  </td>
                  <td>
                    <span className={`text-xs font-medium uppercase tracking-wider ${prioritaColor[task.priorita]}`}>
                      {task.priorita === 'alta' && <ChevronUp size={11} className="inline mr-0.5" />}
                      {task.priorita}
                    </span>
                  </td>
                  <td>{formatDate(task.scadenza)}</td>
                  <td>
                    <DeleteTask id={task.id} onDelete={() => startTransition(() => router.refresh())} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewTaskModal
          staff={staff}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); startTransition(() => router.refresh()) }}
        />
      )}
    </div>
  )
}

function DeleteTask({ id, onDelete }: { id: string; onDelete: () => void }) {
  const supabase = createClient()
  async function del() {
    if (!confirm('Eliminare questo task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    onDelete()
  }
  return (
    <button onClick={del} className="btn-ghost p-1.5 text-stone/50 hover:text-red-400">
      <X size={13} />
    </button>
  )
}

function NewTaskModal({ staff, onClose, onSave }: {
  staff: UserProfile[]
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    titolo: '', descrizione: '', assegnato_a: '',
    priorita: 'media', stato: 'da_fare', scadenza: ''
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.titolo) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tasks').insert({
      ...form,
      creato_da: user?.id,
      assegnato_a: form.assegnato_a || null,
      scadenza: form.scadenza || null,
    })
    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">Nuovo Task</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label-field block mb-1.5">Titolo *</label>
            <input className="input" value={form.titolo} onChange={e => set('titolo', e.target.value)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Descrizione</label>
            <textarea className="input resize-none" rows={2} value={form.descrizione} onChange={e => set('descrizione', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field block mb-1.5">Assegna a</label>
              <select className="input" value={form.assegnato_a} onChange={e => set('assegnato_a', e.target.value)}>
                <option value="">— nessuno —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field block mb-1.5">Priorità</label>
              <select className="input" value={form.priorita} onChange={e => set('priorita', e.target.value)}>
                {PRIORITA.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-field block mb-1.5">Scadenza</label>
            <input type="date" className="input" value={form.scadenza} onChange={e => set('scadenza', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleSave} disabled={saving || !form.titolo} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Crea Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
