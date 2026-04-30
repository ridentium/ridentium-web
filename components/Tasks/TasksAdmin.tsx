'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, UserProfile } from '@/types'
import { formatDate, roleLabel } from '@/lib/utils'
import {
  Plus, X, CheckCircle2, Circle, Clock, ChevronUp, AlertCircle,
  LayoutList, Columns3, Download, Trash2, CheckCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const STATI = ['da_fare', 'in_corso', 'completato'] as const
const PRIORITA = ['bassa', 'media', 'alta'] as const

const statoLabel: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completato: 'Completato',
}
const statoIcon = { da_fare: Circle, in_corso: Clock, completato: CheckCircle2 }
const statoColor: Record<string, string> = {
  da_fare: 'text-stone', in_corso: 'text-gold', completato: 'text-green-400',
}
const statoColBg: Record<string, string> = {
  da_fare: 'border-stone/20 bg-stone/5',
  in_corso: 'border-gold/20 bg-gold/5',
  completato: 'border-green-400/20 bg-green-400/5',
}
const prioritaColor: Record<string, string> = {
  bassa: 'text-stone', media: 'text-gold/70', alta: 'text-red-400',
}

function getLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v !== null ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}

export default function TasksAdmin({ tasks, staff }: { tasks: any[]; staff: UserProfile[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)

  // Filtri persistenti
  const [filterStato, setFilterStato] = useState<string>(() => getLS('tasks_filter', 'tutti'))
  useEffect(() => { localStorage.setItem('tasks_filter', filterStato) }, [filterStato])

  // Vista persistente
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>(() => getLS('tasks_view', 'lista'))
  useEffect(() => { localStorage.setItem('tasks_view', viewMode) }, [viewMode])

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(filtered.filter(t => t.stato !== 'completato').map((t: any) => t.id)))
  }
  function clearSelection() { setSelected(new Set()) }

  async function bulkComplete() {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id =>
      supabase.from('tasks').update({ stato: 'completato', updated_at: new Date().toISOString() }).eq('id', id)
    ))
    setSelected(new Set())
    startTransition(() => router.refresh())
  }

  async function bulkDelete() {
    if (!confirm(`Eliminare ${selected.size} task selezionat${selected.size === 1 ? 'o' : 'i'}?`)) return
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => supabase.from('tasks').delete().eq('id', id)))
    setSelected(new Set())
    startTransition(() => router.refresh())
  }

  // Filtraggio
  const filtered = tasks.filter(t => filterStato === 'tutti' || t.stato === filterStato)

  async function updateStato(id: string, stato: string) {
    await supabase.from('tasks').update({ stato, updated_at: new Date().toISOString() }).eq('id', id)
    startTransition(() => router.refresh())
  }

  // Export CSV
  function exportCSV() {
    const headers = ['Titolo', 'Stato', 'Priorità', 'Assegnato a', 'Scadenza', 'Descrizione']
    const rows = tasks.map(t => [
      t.titolo,
      statoLabel[t.stato] ?? t.stato,
      t.priorita,
      t.assegnato_a_profilo ? `${t.assegnato_a_profilo.nome} ${t.assegnato_a_profilo.cognome}` : '',
      t.scadenza ?? '',
      t.descrizione ?? '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasSelected = selected.size > 0

  return (
    <div className="space-y-5">

      {/* Toolbar: filtri + azioni */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filtri stato */}
        {['tutti', ...STATI].map(s => (
          <button key={s}
            onClick={() => setFilterStato(s)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              filterStato === s
                ? 'bg-gold text-obsidian border-gold'
                : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
            }`}>
            {s === 'tutti' ? `Tutti (${tasks.length})` : `${statoLabel[s]} (${tasks.filter(t => t.stato === s).length})`}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto">
          {/* Vista toggle */}
          <div className="flex border border-obsidian-light rounded overflow-hidden">
            <button
              onClick={() => setViewMode('lista')}
              className={`p-1.5 transition-colors ${viewMode === 'lista' ? 'bg-gold/20 text-gold' : 'text-stone hover:text-cream'}`}
              title="Vista lista"
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-gold/20 text-gold' : 'text-stone hover:text-cream'}`}
              title="Vista Kanban"
            >
              <Columns3 size={14} />
            </button>
          </div>

          {/* Export */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-obsidian-light text-stone hover:border-stone hover:text-cream transition-colors"
            title="Esporta CSV"
          >
            <Download size={13} /> CSV
          </button>

          {/* Nuovo task */}
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <Plus size={13} /> Nuovo task
          </button>
        </div>
      </div>

      {/* Barra azioni bulk (appare con selezione) */}
      {hasSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gold/30 bg-gold/5">
          <span className="text-xs text-gold font-medium">{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</span>
          <button onClick={bulkComplete} className="flex items-center gap-1.5 text-xs px-3 py-1 rounded border border-green-400/30 bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors">
            <CheckCheck size={12} /> Segna completati
          </button>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 text-xs px-3 py-1 rounded border border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">
            <Trash2 size={12} /> Elimina
          </button>
          <button onClick={clearSelection} className="ml-auto text-xs text-stone/60 hover:text-stone transition-colors">
            Annulla selezione
          </button>
        </div>
      )}

      {/* ── Vista LISTA ── */}
      {viewMode === 'lista' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-ridentium">
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      checked={filtered.filter(t => t.stato !== 'completato').length > 0 && filtered.filter(t => t.stato !== 'completato').every(t => selected.has(t.id))}
                      onChange={e => e.target.checked ? selectAll() : clearSelection()}
                      className="accent-gold"
                    />
                  </th>
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
                  <tr>
                    <td colSpan={7}>
                      <div className="py-14 text-center">
                        <CheckCircle2 size={32} className="mx-auto text-stone/20 mb-3" />
                        <p className="text-stone text-sm">
                          {filterStato === 'tutti'
                            ? 'Nessun task creato'
                            : `Nessun task con stato "${statoLabel[filterStato]}"`}
                        </p>
                        {filterStato !== 'tutti' ? (
                          <button onClick={() => setFilterStato('tutti')} className="mt-2 text-xs text-gold/60 hover:text-gold transition-colors">
                            Mostra tutti →
                          </button>
                        ) : (
                          <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-gold/70 hover:text-gold border border-gold/20 hover:border-gold/40 px-3 py-1.5 rounded transition-colors">
                            + Crea il primo task
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((task: any) => {
                  const Icon = statoIcon[task.stato as keyof typeof statoIcon] ?? Circle
                  return (
                    <tr key={task.id} className={task.stato === 'completato' ? 'opacity-50' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          className="accent-gold"
                          disabled={task.stato === 'completato'}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            const next = task.stato === 'da_fare' ? 'in_corso'
                              : task.stato === 'in_corso' ? 'completato' : 'da_fare'
                            updateStato(task.id, next)
                          }}
                          className={`${statoColor[task.stato]} hover:scale-110 transition-transform`}
                          title={`Segna come ${task.stato === 'da_fare' ? 'in corso' : task.stato === 'in_corso' ? 'completato' : 'da fare'}`}
                        >
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
                        <DeleteTask id={task.id} onDelete={() => { setSelected(prev => { const n = new Set(prev); n.delete(task.id); return n }); startTransition(() => router.refresh()) }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vista KANBAN ── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATI.map(stato => {
            const colTasks = tasks.filter(t => t.stato === stato)
            return (
              <div key={stato}>
                {/* Intestazione colonna */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`text-xs font-medium uppercase tracking-wider ${statoColor[stato]}`}>
                    {statoLabel[stato]}
                  </span>
                  <span className="text-[10px] text-stone/40 font-mono">({colTasks.length})</span>
                </div>
                {/* Colonna */}
                <div className={`rounded-xl border p-3 space-y-2 min-h-[140px] ${statoColBg[stato]}`}>
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-xs text-stone/40">Nessun task</p>
                      {stato === 'da_fare' && (
                        <button onClick={() => setShowForm(true)} className="mt-2 text-[10px] text-gold/50 hover:text-gold transition-colors">
                          + Aggiungi
                        </button>
                      )}
                    </div>
                  ) : colTasks.map((task: any) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onStatusChange={updateStato}
                      onDelete={() => startTransition(() => router.refresh())}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

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

// ── KanbanCard ─────────────────────────────────────────────────────────────────

function KanbanCard({ task, onStatusChange, onDelete }: {
  task: any
  onStatusChange: (id: string, stato: string) => void
  onDelete: () => void
}) {
  const supabase = createClient()
  const nextStato = task.stato === 'da_fare' ? 'in_corso'
    : task.stato === 'in_corso' ? 'completato' : 'da_fare'
  const Icon = statoIcon[task.stato as keyof typeof statoIcon] ?? Circle

  async function del() {
    if (!confirm('Eliminare questo task?')) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onDelete()
  }

  return (
    <div
      className={`rounded-lg border bg-obsidian p-3 space-y-2 transition-opacity ${
        task.stato === 'completato' ? 'opacity-50' : 'border-obsidian-light/60 hover:border-obsidian-light'
      }`}
    >
      <p className={`text-sm font-medium leading-snug ${task.stato === 'completato' ? 'line-through text-stone' : 'text-cream'}`}>
        {task.titolo}
      </p>

      {task.assegnato_a_profilo && (
        <p className="text-[11px] text-stone truncate">
          {task.assegnato_a_profilo.nome} {task.assegnato_a_profilo.cognome}
        </p>
      )}

      {task.scadenza && (
        <p className="text-[10px] text-stone/60">{formatDate(task.scadenza)}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className={`text-[10px] uppercase tracking-wider font-medium ${prioritaColor[task.priorita]}`}>
          {task.priorita === 'alta' && <ChevronUp size={10} className="inline mr-0.5" />}
          {task.priorita}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStatusChange(task.id, nextStato)}
            className={`${statoColor[task.stato]} hover:scale-110 transition-transform`}
            title={`Avanza stato`}
          >
            <Icon size={13} />
          </button>
          <button onClick={del} className="text-stone/30 hover:text-red-400 transition-colors p-0.5">
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DeleteTask ─────────────────────────────────────────────────────────────────

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

// ── NewTaskModal ───────────────────────────────────────────────────────────────

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
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (saving) return
    if (!form.titolo.trim()) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: newTask, error: dbError } = await supabase.from('tasks').insert({
      titolo: form.titolo.trim(),
      descrizione: form.descrizione.trim() || null,
      priorita: form.priorita,
      stato: form.stato,
      creato_da: user?.id,
      assegnato_a: form.assegnato_a || null,
      scadenza: form.scadenza || null,
    }).select().single()

    setSaving(false)

    if (dbError) {
      setError(`Errore nel salvataggio: ${dbError.message}`)
      return
    }

    if (form.assegnato_a && newTask?.id) {
      fetch('/api/notify/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: form.assegnato_a,
          taskId: newTask.id,
          titolo: form.titolo.trim(),
          priorita: form.priorita,
        }),
      }).catch(() => {})
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">Nuovo Task</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        {error && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded bg-alert/10 border border-alert/30 text-red-400 text-sm">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label-field block mb-1.5">Titolo *</label>
            <input className="input" value={form.titolo} onChange={e => set('titolo', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }} autoFocus />
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
          <button onClick={handleSave} disabled={saving || !form.titolo.trim()} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Crea Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
