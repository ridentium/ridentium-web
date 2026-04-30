'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types'
import { formatDate } from '@/lib/utils'
import { CheckCircle2, Clock, Circle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import TaskCommenti from '@/components/Tasks/TaskCommenti'

const prioritaColor: Record<string, string> = {
  bassa: 'bg-stone/20 text-stone', media: 'bg-amber-400/15 text-amber-400', alta: 'bg-red-400/15 text-red-400',
}

export default function TasksStaff({ tasks, userId, userNome = '' }: { tasks: Task[]; userId: string; userNome?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function updateStato(id: string, stato: string) {
    setLoadingId(id)
    await supabase.from('tasks').update({ stato }).eq('id', id)
    setLoadingId(null)
    startTransition(() => router.refresh())
  }

  const daFare = tasks.filter(t => t.stato === 'da_fare')
  const inCorso = tasks.filter(t => t.stato === 'in_corso')
  const completati = tasks.filter(t => t.stato === 'completato')

  function TaskCard({ task }: { task: Task }) {
    const scaduta = task.scadenza && new Date(task.scadenza) < new Date() && task.stato !== 'completato'
    const expanded = expandedId === task.id
    const loading = loadingId === task.id

    return (
      <div className={`rounded-xl border transition-all ${
        task.stato === 'completato'
          ? 'border-obsidian-light/30 bg-obsidian/40 opacity-60'
          : task.stato === 'in_corso'
          ? 'border-gold/25 bg-gold/5'
          : 'border-obsidian-light/50 bg-obsidian-light/10'
      }`}>
        {/* Header riga */}
        <button
          className="w-full flex items-start gap-3 p-4 text-left"
          onClick={() => setExpandedId(expanded ? null : task.id)}
        >
          {/* Icona stato */}
          <div className="mt-0.5 flex-shrink-0">
            {task.stato === 'completato'
              ? <CheckCircle2 size={22} className="text-green-400" />
              : task.stato === 'in_corso'
              ? <Clock size={22} className="text-gold" />
              : <Circle size={22} className="text-stone/50" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${
              task.stato === 'completato' ? 'line-through text-stone' : 'text-cream'
            }`}>
              {task.titolo}
            </p>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioritaColor[task.priorita]}`}>
                {task.priorita}
              </span>
              {task.scadenza && (
                <span className={`text-[11px] ${scaduta ? 'text-red-400 font-medium' : 'text-stone'}`}>
                  {scaduta ? '⚠ ' : ''}scad. {formatDate(task.scadenza)}
                </span>
              )}
            </div>
          </div>

          <ChevronDown size={14} className={`text-stone/40 mt-1 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Contenuto espandibile */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-obsidian-light/30 pt-3">
            {task.descrizione && (
              <p className="text-xs text-cream/70 leading-relaxed">{task.descrizione}</p>
            )}

            {/* Bottoni azione grandi per mobile */}
            {task.stato !== 'completato' && (
              <div className="flex gap-2">
                {task.stato === 'da_fare' && (
                  <button
                    onClick={() => updateStato(task.id, 'in_corso')}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl border border-gold/30 bg-gold/10 text-gold text-sm font-medium hover:bg-gold/20 active:bg-gold/30 transition-colors disabled:opacity-50"
                  >
                    {loading ? '…' : 'Inizia'}
                  </button>
                )}
                {task.stato === 'in_corso' && (
                  <>
                    <button
                      onClick={() => updateStato(task.id, 'da_fare')}
                      disabled={loading}
                      className="flex-1 py-3 rounded-xl border border-obsidian-light text-stone text-sm hover:border-stone hover:text-cream active:bg-obsidian-light/30 transition-colors disabled:opacity-50"
                    >
                      {loading ? '…' : 'Metti in pausa'}
                    </button>
                    <button
                      onClick={() => updateStato(task.id, 'completato')}
                      disabled={loading}
                      className="flex-1 py-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 active:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {loading ? '…' : 'Completato ✓'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Commenti */}
            <div className="mt-1">
              <TaskCommenti
                taskId={task.id}
                userId={userId}
                userNome={userNome}
                isAdmin={false}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 size={40} className="text-green-400 mb-4" />
        <p className="text-cream/70 font-medium">Nessun task assegnato</p>
        <p className="text-stone text-sm mt-1">Ottimo lavoro, sei in pari!</p>
        <p className="text-stone/40 text-xs mt-3">I task vengono assegnati dall&apos;admin o dal manager</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-stone/40 px-1">
        I task vengono assegnati dall&apos;admin o dal manager. Contattali per aggiungerne di nuovi.
      </p>
      {daFare.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone/60 mb-3 px-1">
            Da fare ({daFare.length})
          </h2>
          <div className="space-y-2">
            {daFare.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </section>
      )}

      {inCorso.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold/70 mb-3 px-1">
            In corso ({inCorso.length})
          </h2>
          <div className="space-y-2">
            {inCorso.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </section>
      )}

      {completati.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone/50 mb-3 px-1">
            Completati ({completati.length})
          </h2>
          <div className="space-y-2">
            {completati.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </section>
      )}
    </div>
  )
}
