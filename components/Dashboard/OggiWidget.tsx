'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckSquare, ShieldCheck, RefreshCw, Check, Loader2 } from 'lucide-react'

export interface OggiItem {
  id: string
  tipo: 'task' | 'adempimento' | 'ricorrente'
  titolo: string
  href: string
  urgente?: boolean
}

const tipoIcon = { task: CheckSquare, adempimento: ShieldCheck, ricorrente: RefreshCw }
const tipoColor = {
  task: 'text-blue-400',
  adempimento: 'text-amber-400',
  ricorrente: 'text-gold',
}

export default function OggiWidget({ items: initialItems }: { items: OggiItem[] }) {
  const [items, setItems] = useState<OggiItem[]>(initialItems)
  const [completing, setCompleting] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  if (items.length === 0 && done.size === 0) return null

  const visible = items.filter(i => !done.has(i.id))

  async function complete(item: OggiItem) {
    if (item.tipo !== 'task' || completing) return
    setCompleting(item.id)
    try {
      await fetch(`/api/tasks/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: 'completato' }),
      })
      setDone(prev => new Set(prev).add(item.id))
    } finally {
      setCompleting(null)
    }
  }

  const tasks = visible.filter(i => i.tipo === 'task')
  const adempimenti = visible.filter(i => i.tipo === 'adempimento')
  const ricorrenti = visible.filter(i => i.tipo === 'ricorrente')

  if (visible.length === 0) {
    return (
      <div id="widget-oggi" className="card flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-green-400" />
        </div>
        <div>
          <p className="text-sm text-cream/80">Tutto completato per oggi</p>
          <p className="text-xs text-stone/50">Ottimo lavoro!</p>
        </div>
      </div>
    )
  }

  return (
    <div id="widget-oggi" className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-gold" />
          <h3 className="text-xs font-medium text-cream uppercase tracking-widest">Oggi</h3>
        </div>
        <span className="text-[10px] text-stone/40">{visible.length} element{visible.length === 1 ? 'o' : 'i'}</span>
      </div>

      <div className="space-y-1">
        {visible.map(item => {
          const Icon = tipoIcon[item.tipo]
          const isLoading = completing === item.id
          return (
            <div key={item.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-obsidian-light/20 transition-colors group">
              {item.tipo === 'task' ? (
                <button
                  onClick={() => complete(item)}
                  disabled={!!completing}
                  className="flex-shrink-0 w-5 h-5 rounded border border-obsidian-light/60 hover:border-green-400/60 hover:bg-green-400/10 flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Segna come fatto"
                >
                  {isLoading
                    ? <Loader2 size={10} className="animate-spin text-stone" />
                    : <Check size={10} className="text-stone/40 group-hover:text-green-400 transition-colors" />
                  }
                </button>
              ) : (
                <Icon size={13} className={`${tipoColor[item.tipo]} flex-shrink-0`} />
              )}
              <Link
                href={item.href}
                className={`flex-1 text-sm truncate transition-colors ${item.urgente ? 'text-red-400' : 'text-cream/80'} hover:text-cream`}
              >
                {item.titolo}
              </Link>
              {item.urgente && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">
                  urgente
                </span>
              )}
            </div>
          )
        })}
      </div>

      {(tasks.length > 0 || adempimenti.length > 0 || ricorrenti.length > 0) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-obsidian-light/30">
          {tasks.length > 0 && (
            <Link href="/admin/tasks" className="text-[10px] text-stone/50 hover:text-gold transition-colors">
              {tasks.length} task →
            </Link>
          )}
          {adempimenti.length > 0 && (
            <Link href="/admin/adempimenti" className="text-[10px] text-stone/50 hover:text-gold transition-colors">
              {adempimenti.length} adempiment{adempimenti.length === 1 ? 'o' : 'i'} →
            </Link>
          )}
          {ricorrenti.length > 0 && (
            <Link href="/admin/ricorrenti" className="text-[10px] text-stone/50 hover:text-gold transition-colors">
              {ricorrenti.length} ricorrent{ricorrenti.length === 1 ? 'e' : 'i'} →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
