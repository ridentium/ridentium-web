'use client'

import { useState, useEffect, useTransition } from 'react'
import { Task, UserProfile } from '@/types'
import { formatDate, roleLabel } from '@/lib/utils'
import {
  Plus, X, CheckCircle2, Circle, Clock, ChevronUp, AlertCircle,
  LayoutList, Columns3, Download, Trash2, CheckCheck, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useUserPref } from '@/lib/useUserPref'

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

export default function TasksAdmin({ tasks, staff, currentUserId = '' }: { tasks: Task[]; staff: UserProfile[]; currentUserId?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)

  // Filtri — legge ?filter=aperti dall'URL al primo render (override rispetto a DB)
  const [filterStatoDb, setFilterStatoDb] = useUserPref<string>('tasks_filter', 'tutti')
  const [filterStato, setFilterStato] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const f = new URL(window.location.href).searchParams.get('filter')
      if (f === 'aperti') return 'aperti'
    }
    return filterStatoDb
  })
  // Sincronizza il cambio filtro verso DB
  function handleFilterStato(v: string) { setFilterStato(v); setFilterStatoDb(v) }

  const [filterPriorita, setFilterPriorita] = useState<string>('tutte')
  const [filterScadenza, setFilterScadenza] = useState<string>('tutte')
  const [filterAssegnato, setFilterAssegnato] = useState<string>('')
  const [cerca, setCerca] = useState('')

  // Vista persistente (cross-device via DB)
  const [viewMode, setViewMode] = useUserPref<'lista' | 'kanban'>('tasks_view', 'lista')

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(filtered.filter(t => t.stato !== 'completato').map((t: Task) => t.id)))
  }
  function clearSelection() { setSelected(new Set()) }

  async function bulkComplete() {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: 'completato' }),
      })
    ))
    setSelected(new Set())
    startTransition(() => router.refresh())
  }

  async function bulkDelete() {
    const ids = Array.from(selected)
    await Promise.all(ids.map(id => fetch(`/api/tasks/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    setConfirmBulkDelete(false)
    startTransition(() => router.refresh())
  }

  // Filtraggio
  const filtered = tasks.filter(t => {
    if (filterStato === 'miei' && t.assegnato_a !== currentUserId) return false
    else if (filterStato === 'aperti' && t.stato === 'completato') return false
    else if (!['tutti', 'aperti', 'miei'].includes(filterStato) && t.stato !== filterStato) return false
    if (filterPriorita !== 'tutte' && t.priorita !== filterPriorita) return false
    if (filterAssegnato && t.assegnato_a !== filterAssegnato) return false
    if (cerca.trim()) {
      const q = cerca.toLowerCase()
      if (!t.titolo?.toLowerCase().includes(q) && !t.descrizione?.toLowerCase().includes(q)) return false
    }
    if (filterScadenza !== 'tutte') {
      const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
      const fine = new Date(oggi); fine.setDate(oggi.getDate() + 6)
      if (filterScadenza === 'senza') { if (t.scadenza) return false }
      else if (filterScadenza === 'scaduto') {
        if (!t.scadenza) return false
        const d = new Date(t.scadenza); d.setHours(0, 0, 0, 0)
        if (d >= oggi || t.stato === 'completato') return false
      } else if (filterScadenza === 'oggi') {
        if (!t.scadenza) return false
        const d = new Date(t.scadenza); d.setHours(0, 0, 0, 0)
        if (d.getTime() !== oggi.getTime()) return false
      } else if (filterScadenza === 'questa_settimana') {
        if (!t.scadenza) return false
        const d = new Date(t.scadenza); d.setHours(0, 0, 0, 0)
        if (d < oggi || d > fine) return false
      }
    }
    return true
  })

  const hasFilters = filterStato !== 'tutti' || filterPriorita !== 'tutte' || filterScadenza !== 'tutte' || filterAssegnato || cerca.trim()
  function resetFilters() {
    handleFilterStato('tutti'); setFilterPriorita('tutte'); setFilterScadenza('tutte'); setFilterAssegnato(''); setCerca('')
  }

  async function updateStato(id: string, stato: string) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato }),
    })
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
            onClick={() => handleFilterStato(s)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              filterStato === s
                ? 'bg-gold text-obsidian border-gold'
                : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
            }`}>
            {s === 'tutti' ? `Tutti (${tasks.length})` : `${statoLabel[s]} (${tasks.filter(t => t.stato === s).length})`}
          </button>
        ))}
        {currentUserId && (
          <button
            onClick={() => handleFilterStato('miei')}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              filterStato === 'miei'
                ? 'bg-gold text-obsidian border-gold'
                : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
            }`}>
            I miei ({tasks.filter(t => t.assegnato_a === currentUserId).length})
          </button>
        )}

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

      {/* Filtri avanzati */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone/40" />
          <input
            type="text"
            placeholder="Cerca task…"
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            className="input text-xs py-1.5 pl-7 w-40"
          />
        </div>
        <select
          value={filterPriorita}
          onChange={e => setFilterPriorita(e.target.value)}
          className="input text-xs py-1.5"
        >
          <option value="tutte">Priorità: tutte</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="bassa">Bassa</option>
        </select>
        <select
          value={filterScadenza}
          onChange={e => setFilterScadenza(e.target.value)}
          className="input text-xs py-1.5"
        >
          <option value="tutte">Scadenza: tutte</option>
          <option value="scaduto">Scaduti</option>
          <option value="oggi">Oggi</option>
          <option value="questa_settimana">Questa settimana</option>
          <option value="senza">Senza scadenza</option>
        </select>
        <select
          value={filterAssegnato}
          onChange={e => setFilterAssegnato(e.target.value)}
          className="input text-xs py-1.5"
        >
          <option value="">Assegnato: tutti</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-stone hover:text-cream transition-colors">
            <X size={11} /> Reset
          </button>
        )}
        <span className="text-xs text-stone/40 ml-auto">{filtered.length} task</span>
      </div>

      {/* Barra azioni bulk (appare con selezione) */}
      {hasSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gold/30 bg-gold/5">
          <span className="text-xs text-gold font-medium">{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</span>
          <button onClick={bulkComplete} className="flex items-center gap-1.5 text-xs px-3 py-1 rounded border border-green-400/30 bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors">
            <CheckCheck size={12} /> Segna completati
          </button>
          {confirmBulkDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400/80">Confermi eliminazione?</span>
              <button onClick={bulkDelete} className="text-xs px-2 py-0.5 rounded bg-red-400/20 border border-red-400/30 text-red-400 hover:bg-red-400/30 transition-colors font-medium">Sì</button>
              <button onClick={() => setConfirmBulkDelete(false)} className="text-xs text-stone hover:text-cream transition-colors">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmBulkDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1 rounded border border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">
              <Trash2 size={12} /> Elimina
            </button>
          )}
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
                            : filterStato === 'aperti'
                              ? 'Nessun task aperto (da fare o in corso)'
                              : filterStato === 'miei'
                                ? 'Nessun task assegnato a te'
                                : `Nessun task con stato "${statoLabel[filterStato]}"`}
                        </p>
                        {filterStato !== 'tutti' ? (
                          <button onClick={() => handleFilterStato('tutti')} className="mt-2 text-xs text-gold/60 hover:text-gold transition-colors">
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
                ) : filtered.map((task: Task) => {
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
            const colTasks = filtered.filter(t => t.stato === stato)
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
                  ) : colTasks.map((task: Task) => (
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
  task: Task
  onStatusChange: (id: string, stato: string) => void
  onDelete: () => void
}) {
  const nextStato = task.stato === 'da_fare' ? 'in_corso'
    : task.stato === 'in_corso' ? 'completato' : 'da_fare'
  const Icon = statoIcon[task.stato as keyof typeof statoIcon] ?? Circle

  async function del() {
    if (!confirm('Eliminare questo task?')) return
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
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
  async function del() {
    if (!confirm('Eliminare questo task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
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

    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: form.titolo.trim(),
          descrizione: form.descrizione.trim() || undefined,
          priorita: form.priorita,
          scadenza: form.scadenza || undefined,
          assegnato_a: form.assegnato_a || undefined,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error ?? 'Errore nel salvataggio')
        return
      }
      onSave()
    } catch {
      setError('Errore di rete')
    } finally {
      setSaving(false)
    }
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
