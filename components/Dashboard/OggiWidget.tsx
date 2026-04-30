'use client'

import Link from 'next/link'
import { CalendarDays, CheckSquare, ShieldCheck, RefreshCw } from 'lucide-react'

interface OggiItem {
  id: string
  tipo: 'task' | 'adempimento' | 'ricorrente'
  titolo: string
  href: string
  urgente?: boolean
}

export default function OggiWidget({ items }: { items: OggiItem[] }) {
  if (items.length === 0) return null

  const tasks = items.filter(i => i.tipo === 'task')
  const adempimenti = items.filter(i => i.tipo === 'adempimento')
  const ricorrenti = items.filter(i => i.tipo === 'ricorrente')

  const tipoIcon = { task: CheckSquare, adempimento: ShieldCheck, ricorrente: RefreshCw }
  const tipoColor = {
    task: 'text-blue-400',
    adempimento: 'text-amber-400',
    ricorrente: 'text-gold',
  }

  return (
    <div id="widget-oggi" className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-gold" />
          <h3 className="text-xs font-medium text-cream uppercase tracking-widest">Oggi</h3>
        </div>
        <span className="text-[10px] text-stone/40">{items.length} element{items.length === 1 ? 'o' : 'i'}</span>
      </div>

      <div className="space-y-1">
        {items.map(item => {
          const Icon = tipoIcon[item.tipo]
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-obsidian-light/30 transition-colors group"
            >
              <Icon size={13} className={tipoColor[item.tipo]} />
              <span className={`flex-1 text-sm truncate ${item.urgente ? 'text-red-400' : 'text-cream/80'} group-hover:text-cream transition-colors`}>
                {item.titolo}
              </span>
              {item.urgente && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">
                  urgente
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {(tasks.length > 0 || adempimenti.length > 0) && (
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
