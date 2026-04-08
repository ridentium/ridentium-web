'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types'
import { formatDate } from '@/lib/utils'
import { Circle, Clock, CheckCircle2, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

const statoLabel: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completato: 'Completato'
}
const statoColor: Record<string, string> = {
  da_fare: 'text-stone', in_corso: 'text-gold', completato: 'text-green-400'
}
const prioritaColor: Record<string, string> = {
  bassa: 'text-stone', media: 'text-gold/70', alta: 'text-red-400'
}

export default function TasksStaff({ tasks, userId }: { tasks: Task[]; userId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function updateStato(id: string, stato: string) {
    await supabase.from('tasks').update({ stato }).eq('id', id)
    startTransition(() => router.refresh())
  }

  const daFare = tasks.filter(t => t.stato === 'da_fare')
  const inCorso = tasks.filter(t => t.stato === 'in_corso')
  const completati = tasks.filter(t => t.stato === 'completato')

  function TaskRow({ task }: { task: Task }) {
    return (
      <div className="flex items-start gap-4 py-3 border-b border-obsidian-light/40 last:border-0">
        <button
          onClick={() => {
            const next = task.stato === 'da_fare' ? 'in_corso'
                       : task.stato === 'in_corso' ? 'completato' : 'da_fare'
            updateStato(task.id, next)
          }}
          className={`mt-0.5 ${statoColor[task.stato]} hover:scale-110 transition-transform shrink-0`}
        >
          {task.stato === 'completato' ? <CheckCircle2 size={18} /> :
           task.stato === 'in_corso' ? <Clock size={18} /> :
           <Circle size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.stato === 'completato' ? 'line-through text-stone' : 'text-cream'}`}>
            {task.titolo}
          </p>
          {task.descrizione && (
            <p className="text-xs text-stone mt-0.5 leading-relaxed">{task.descrizione}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`text-xs ${prioritaColor[task.priorita]}`}>
              {task.priorita === 'alta' && <ChevronUp size={10} className="inline" />}
              {task.priorita}
            </span>
            {task.scadenza && (
              <span className={`text-xs ${new Date(task.scadenza) < new Date() && task.stato !== 'completato' ? 'text-red-400' : 'text-stone'}`}>
                scad. {formatDate(task.scadenza)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="card text-center py-12">
        <CheckCircle2 size={24} className="text-green-400 mx-auto mb-3" />
        <p className="text-stone text-sm">Nessun task assegnato. Ottimo lavoro!</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {daFare.length > 0 && (
        <div className="card">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-3">Da fare ({daFare.length})</h3>
          {daFare.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
      {inCorso.length > 0 && (
        <div className="card border-gold/10">
          <h3 className="text-xs uppercase tracking-widest text-gold mb-3">In corso ({inCorso.length})</h3>
          {inCorso.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
      {completati.length > 0 && (
        <div className="card opacity-60">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-3">Completati ({completati.length})</h3>
          {completati.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  )
}
