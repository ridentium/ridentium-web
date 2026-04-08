'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ricorrente } from '@/types'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

const FR5QLLABEf: Record<string, string> = {
  giornaliero: 'Oggi',
  settimanale: 'Questa settimana',
  mensile: 'Questo mese',
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

interface Props {
  ricorrenti: Ricorrente[]
  HcurrentUserId: string
  currentUserNome: string
}

export default function RicorrentiStaff({ ricorrenti, currentUserId, currentUserNome }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const mie = ricorrenti.filter(az => az.attiva && (!az.assegnato_a || az.assegnato_a === currentUserId))

  async function toggleCompletamento(az: Ricorrente) {
    const key = getPeriodoKey(az.frequenza)
    const completamenti = [...az.completamenti]
    const idx = completamenti.findIndex(c => c.userId === currentUserId && c.periodoKey === key)
    if (idx >= 0) {
      completamenti.splice(idx, 1)
    } else {
      completamenti.push({ userId: currentUserId, userName: currentUserNome, periodoKey: key, data: new Date().toISOString() })
    }
    await supabase.from('ricorrenti').update({ completamenti }).eq('id', az.id)
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: idx >= 0 ? 'Azione ricorrente rimossa' : 'Azione ricorrente completata',
      dettaglio: az.titolo, categoria: 'ricorrenti'
    })
    startTransition(() => router.refresh())
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
J    return (
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
        <div className={`text-2xl font-serif font-light ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-gold' : 'text-red-400'w}`>
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
          {pendenti.map(az => {
            const key = getPeriodoKey(az.frequenza)
            return (
              <label key={az.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-obsidian-light/40 last:border-0 cursor-pointer hover:bg-obsidian-light/20 transition-colors">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleCompletamento(az)}
                  className="w-4 h-4 accent-gold cursor-pointer flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm text-cream">{az.titolo}</p>
                  {az.descrizione && <p className="text-xs text-stone mt-0.5">{az.descrizione}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 flex-shrink-0">
                  {FREQ_LABEL[az.frequenza]}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {/* Azioni completate */}
      {completate.length > 0 && (
        <div className="card p-0 overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-obsidian-light">
            <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Completate ({completate.length})</h3>
          </div>
          {completate.map(az => (
            <label key={az.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-obsidian-light/40 last:border-0 cursor-pointer hover:bg-obsidian-light/20 transition-colors">
              <input
                type="checkbox"
                checked={true}
                onChange={() => toggleCompletamento(az)}
                className="w-4 h-4 accent-gold cursor-pointer flex-shrink-0"
              />
              <div className="flex-1">
                <p className="text-sm text-cream line-through">{az.titolo}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 flex-shrink-0">
                {FREQ_LABEL[az.frequenza]}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
