'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MagazzinoItem } from '@/types'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle, ShoppingCart, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  items: MagazzinoItem[]
  riordiniAperti: string[]
  userId: string
}

const CATEGORIE = [
  'Tutte', 'Impianti', 'Componentistica Protesica', 'Materiali Chirurgici',
  'Consumabili', 'DPI & Sterilizzazione'
]

export default function MagazzinoStaff({ items, riordiniAperti, userId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [categoria, setCategoria] = useState('Tutte')
  const [soloAlert, setSoloAlert] = useState(false)
  const [riordineNote, setRiordineNote] = useState<Record<string, string>>({})
  const [localRiordini, setLocalRiordini] = useState<string[]>(riordiniAperti)

  const filtered = items.filter(item => {
    if (categoria !== 'Tutte' && item.categoria !== categoria) return false
    if (soloAlert && item.quantita >= item.soglia_minima) return false
    return true
  })

  const alertCount = items.filter(i => i.quantita < i.soglia_minima).length

  async function richiediRiordine(itemId: string) {
    await supabase.from('riordini').insert({
      magazzino_id: itemId,
      richiesto_da: userId,
      note: riordineNote[itemId] || null,
    })
    setLocalRiordini(prev => [...prev, itemId])
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-3">
        {CATEGORIE.map(cat => (
          <button key={cat}
                  onClick={() => setCategoria(cat)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    categoria === cat
                      ? 'bg-gold text-obsidian border-gold'
                      : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  }`}>
            {cat}
          </button>
        ))}
        <button onClick={() => setSoloAlert(!soloAlert)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ml-auto ${
                  soloAlert
                    ? 'bg-red-400/10 text-red-400 border-red-400/30'
                    : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                }`}>
          <AlertTriangle size={11} />
          Solo sotto soglia ({alertCount})
        </button>
      </div>

      {/* Tabella */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table-ridentium">
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Categoria</th>
              <th>Diametro</th>
              <th>Lunghezza</th>
              <th>Qtà</th>
              <th>Stato</th>
              <th>Riordina</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-stone py-8">Nessun prodotto</td></tr>
            ) : filtered.map(item => {
              const isAlert = item.quantita < item.soglia_minima
              const riordinato = localRiordini.includes(item.id)
              return (
                <tr key={item.id} className={isAlert ? 'bg-red-400/5' : ''}>
                  <td className="font-medium text-cream">{item.prodotto}</td>
                  <td className="text-stone">{item.categoria}</td>
                  <td>{item.diametro ? `ø${item.diametro}` : '—'}</td>
                  <td>{item.lunghezza ? `${item.lunghezza}mm` : '—'}</td>
                  <td className="font-medium">{item.quantita} {item.unita}</td>
                  <td>
                    {isAlert
                      ? <span className="badge-alert"><AlertTriangle size={10} /> Sotto soglia</span>
                      : <span className="badge-ok"><CheckCircle size={10} /> OK</span>
                    }
                  </td>
                  <td>
                    {riordinato ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Check size={11} /> Segnalato
                      </span>
                    ) : (
                      <button
                        onClick={() => richiediRiordine(item.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                          isAlert
                            ? 'border-gold/40 text-gold hover:bg-gold/10'
                            : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                        }`}
                      >
                        <ShoppingCart size={11} /> Riordina
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
