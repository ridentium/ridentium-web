'use client'

import { useState, useTransition } from 'react'
import { Ricorrente } from '@/types'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getPeriodoKey } from '@/lib/periodo'

const FREQ_LABEL: Record<string, string> = {
  giornaliero:  'Oggi',
  settimanale:  'Questa settimana',
  mensile:      'Questo mese',
  trimestrale:  'Questo trimestre',
  semestrale:   'Questo semestre',
  annuale:      'Quest\'anno',
  biennale:     'Questo biennio',
  triennale:    'Questo triennio',
  quinquennale: 'Questo quinquennio',
}

interface Props {
  ricorrenti: Ricorrente[]
  currentUserId: string
  currentUserNome: string
}

export default function RicorrentiStaff({ ricorrenti, currentUserId, currentUserNome }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toggling, setToggling] = useState<string | null>(null)

  const mie = ricorrenti.filter(az => az.attiva && (!az.assegnato_a || az.assegnato_a === currentUserId))

  // Toggle via API atomica (RPC Postgres FOR UPDATE — nessuna race condition)
  async function toggleCompletamento(az: Ricorrente) {
    if (toggling === az.id) return
    setToggling(az.id)
    try {
      const res = await fetch(`/api/ricorrenti/${az.id}/completamento`, { method: 'POST' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Errore sconosciuto' }))
        console.error('[toggleCompletamento]', error)
      }
      startTransition(() => router.refresh())
    } finally {
      setToggling(null)
    }
  }

  const pendenti = mie.filter(az => {
    const key = getPeriodoKey(az.frequenza)
    return !az.completamenti.some(c => c.userId === currentUserId && c.periodoKey === key)
  })
  const completate = mie.filter(az => {
    const key = getPeriodoKey(az.frequenza)
    return az.completamenti.some(c => c.userId === currentUserId && c.periodoKey === key)
  })
  const pct = mie.length > 0 ? Math.round((completate.length / mie.length) * 100) : 100

  return (
    <div className="space-y-5">

      {/* Stato generale */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw size={16} className="text-stone" />
          <div>
            <p className="text-sm text-cream font-medium">{completate.length} / {mie.length} completate</p>
            <p className="text-xs text-stone">Periodo corrente</p>
          </div>
        </div>
        <div className={`text-2xl font-serif font-light ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-gold' : 'text-red-400'}`}>
          {pct}%
        </div>
      </div>

      {/* Azioni da completare */}
      {pendenti.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-green-400 font-medium text-sm">✓ Tutte le azioni completate per questo periodo!</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-obsidian-light">
            <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Da completare</h3>
          </div>
          {pendenti.map(az => (
            <label
              key={az.id}
              className={`flex items-center gap-4 px-5 py-3.5 border-b border-obsidian-light/40 last:border-0 cursor-pointer hover:bg-obsidian-light/20 transition-colors ${toggling === az.id ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleCompletamento(az)}
                disabled={toggling === az.id}
                className="w-4 h-4 accent-gold cursor-pointer flex-shrink-0 disabled:cursor-wait"
              />
              <div className="flex-1">
                <p className="text-sm text-cream">{az.titolo}</p>
                {az.descrizione && <p className="text-xs text-stone mt-0.5">{az.descrizione}</p>}
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 flex-shrink-0">
                {FREQ_LABEL[az.frequenza] ?? az.frequenza}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Azioni completate */}
      {completate.length > 0 && (
        <div className="card p-0 overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-obsidian-light">
            <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Completate ({completate.length})</h3>
          </div>
          {completate.map(az => (
            <label
              key={az.id}
              className={`flex items-center gap-4 px-5 py-3.5 border-b border-obsidian-light/40 last:border-0 cursor-pointer hover:bg-obsidian-light/20 transition-colors ${toggling === az.id ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <input
                type="checkbox"
                checked={true}
                onChange={() => toggleCompletamento(az)}
                disabled={toggling === az.id}
                className="w-4 h-4 accent-gold cursor-pointer flex-shrink-0 disabled:cursor-wait"
              />
              <div className="flex-1">
                <p className="text-sm text-cream line-through">{az.titolo}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 flex-shrink-0">
                {FREQ_LABEL[az.frequenza] ?? az.frequenza}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
