'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'
import { CheckSquare, RefreshCw } from 'lucide-react'

interface CompletableTask {
  id: string
  titolo: string
  scadenza?: string | null
  priorita: string
}

interface Completamento {
  userId: string
  userName: string
  periodoKey: string
  data: string
  nota?: string
}

interface CompletableRicorrente {
  id: string
  titolo: string
  frequenza: string
  assegnato_a?: string | null
  completamenti: Completamento[]
}

interface Props {
  tasks: CompletableTask[]
  ricorrenti: CompletableRicorrente[]
  currentUserId: string
  currentUserNome: string
}

function getPeriodoKey(frequenza: string): string {
  const now = new Date()
  if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
  if (frequenza === 'settimanale') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() + 1)
    return 'W' + d.toISOString().split('T')[0]
  }
  if (frequenza === 'mensile') {
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  }
  return now.toISOString().split('T')[0]
}

function NotePopup({ onSave, onSkip }: { onSave: (nota: string) => void; onSkip: () => void }) {
  const [nota, setNota] = useState('')
  return (
    <div className="ml-6 mt-1 mb-2 p-3 rounded bg-obsidian-light/40 border border-obsidian-light/60 space-y-2">
      <input
        type="text"
        placeholder="Aggiungi una nota (facoltativo)"
        value={nota}
        onChange={e => setNota(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(nota) }}
        className="input text-xs py-1.5"
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={() => onSave(nota)} className="btn-primary text-xs py-1 px-3">
          Salva nota
        </button>
        <button onClick={onSkip} className="btn-ghost text-xs py-1 px-2 text-stone">
          Salta
        </button>
      </div>
    </div>
  )
}

export default function TasksRicorrentiWidget({ tasks, ricorrenti, currentUserId, currentUserNome }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set())
  const [completedRicorrentiIds, setCompletedRicorrentiIds] = useState<Set<string>>(new Set())
  const [noteFor, setNoteFor] = useState<{ type: 'task' | 'ricorrente'; id: string } | null>(null)

  // Ricorrenti non ancora completate per il periodo corrente
  const pendingRicorrenti = ricorrenti.filter(r => {
    if (!r.attiva) return false
    const key = getPeriodoKey(r.frequenza)
    const alreadyDone = (r.completamenti ?? []).some(
      c => c.periodoKey === key
    )
    return !alreadyDone && !completedRicorrentiIds.has(r.id)
  })

  const pendingTasks = tasks.filter(t => !completedTaskIds.has(t.id))

  async function onCheckTask(task: CompletableTask) {
    if (completedTaskIds.has(task.id)) return
    setCompletedTaskIds(prev => new Set([...prev, task.id]))
    setNoteFor({ type: 'task', id: task.id })
  }

  async function saveTask(task: CompletableTask, nota: string) {
    await supabase.from('tasks').update({ stato: 'completato' }).eq('id', task.id)
    await logActivity(
      currentUserId, currentUserNome, 'Task completato',
      nota ? `${task.titolo} — ${nota}` : task.titolo, 'ricorrenti'
    ).catch(() => {})
    setNoteFor(null)
    startTransition(() => router.refresh())
  }

  async function onCheckRicorrente(r: CompletableRicorrente) {
    if (completedRicorrentiIds.has(r.id)) return
    setCompletedRicorrentiIds(prev => new Set([...prev, r.id]))
    setNoteFor({ type: 'ricorrente', id: r.id })
  }

  async function saveRicorrente(r: CompletableRicorrente, nota: string) {
    const key = getPeriodoKey(r.frequenza)
    const newComp: Completamento = {
      userId: currentUserId,
      userName: currentUserNome,
      periodoKey: key,
      data: new Date().toISOString(),
      ...(nota ? { nota } : {}),
    }
    const completamenti = [...(r.completamenti ?? []), newComp]
    await supabase.from('ricorrenti').update({ completamenti }).eq('id', r.id)
    await logActivity(
      currentUserId, currentUserNome, 'Azione ricorrente completata',
      nota ? `${r.titolo} — ${nota}` : r.titolo, 'ricorrenti'
    ).catch(() => {})
    setNoteFor(null)
    startTransition(() => router.refresh())
  }

  if (pendingTasks.length === 0 && pendingRicorrenti.length === 0) {
    return <p className="text-stone text-sm py-4 text-center">✓ Tutto completato</p>
  }

  return (
    <div className="space-y-1">
      {/* Task */}
      {pendingTasks.slice(0, 6).map(task => (
        <div key={task.id}>
          <div className="flex items-start gap-3 py-2 border-b border-obsidian-light/30 last:border-0">
            <input
              type="checkbox"
              checked={completedTaskIds.has(task.id)}
              onChange={() => onCheckTask(task)}
              disabled={completedTaskIds.has(task.id)}
              className="mt-0.5 cursor-pointer accent-gold shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${completedTaskIds.has(task.id) ? 'line-through text-stone' : 'text-cream/80'}`}>
                {task.titolo}
              </p>
              <p className="text-xs text-stone mt-0.5">
                Task
                {task.priorita === 'alta' && <span className="text-red-400 ml-1">· Alta priorità</span>}
                {task.scadenza && <span className="ml-1">· {new Date(task.scadenza).toLocaleDateString('it-IT')}</span>}
              </p>
            </div>
            <CheckSquare size={12} className="text-stone/30 shrink-0 mt-1" />
          </div>
          {noteFor?.type === 'task' && noteFor.id === task.id && (
            <NotePopup
              onSave={nota => saveTask(task, nota)}
              onSkip={() => saveTask(task, '')}
            />
          )}
        </div>
      ))}

      {/* Ricorrenti */}
      {pendingRicorrenti.slice(0, 6).map(r => (
        <div key={r.id}>
          <div className="flex items-start gap-3 py-2 border-b border-obsidian-light/30 last:border-0">
            <input
              type="checkbox"
              checked={completedRicorrentiIds.has(r.id)}
              onChange={() => onCheckRicorrente(r)}
              disabled={completedRicorrentiIds.has(r.id)}
              className="mt-0.5 cursor-pointer accent-gold shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${completedRicorrentiIds.has(r.id) ? 'line-through text-stone' : 'text-cream/80'}`}>
                {r.titolo}
              </p>
              <p className="text-xs text-stone mt-0.5 capitalize flex items-center gap-1">
                <RefreshCw size={10} className="text-stone/50" />
                {r.frequenza}
              </p>
            </div>
          </div>
          {noteFor?.type === 'ricorrente' && noteFor.id === r.id && (
            <NotePopup
              onSave={nota => saveRicorrente(r, nota)}
              onSkip={() => saveRicorrente(r, '')}
            />
          )}
        </div>
      ))}
    </div>
  )
}
