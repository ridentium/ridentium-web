'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MagazzinoItem } from '@/types'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle, ShoppingCart, Check, Clock, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

function getExpiryStatus(scadenza?: string | null): 'expired' | 'expiring' | 'ok' | 'none' {
  if (!scadenza) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expDate = new Date(scadenza)
  if (expDate < today) return 'expired'
  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)
  if (expDate <= in30) return 'expiring'
  return 'ok'
}

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
  const [soloScadenza, setSoloScadenza] = useState(false)
  const [riordineNote, setRiordineNote] = useState<Record<string, string>>({})
  const [localRiordini, setLocalRiordini] = useState<string[]>(riordiniAperti)

  const filtered = items.filter(item => {
    if (categoria !== 'Tutte' && item.categoria !== categoria) return false
    if (soloAlert && item.quantita >= item.soglia_minima) return false
    if (soloScadenza) {
      const es = getExpiryStatus(item.scadenza)
      if (es === 'ok' || es === 'none') return false
    }
    return true
  })

  const alertCount = items.filter(i => i.quantita < i.soglia_minima).length
  const scadenzaCount = items.filter(i => {
    const es = getExpiryStatus(i.scadenza)
    return es === 'expired' || es === 'expiring'
  }).length

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
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => { setSoloAlert(!soloAlert); setSoloScadenza(false) }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                    soloAlert
                      ? 'bg-red-400/10 text-red-400 border-red-400/30'
                      : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  }`}>
            <AlertTriangle size={11} />
            Sotto soglia ({alertCount})
          </button>
          <button onClick={() => { setSoloScadenza(!soloScadenza); setSoloAlert(false) }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                    soloScadenza
                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                      : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  }`}>
            <Clock size={11} />
            In scadenza ({scadenzaCount})
          </button>
        </div>
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
              <th>Scadenza</th>
              <th>Stato</th>
              <th>Riordina</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-stone py-8">Nessun prodotto</td></tr>
            ) : filtered.map(item => {
              const isAlert = item.quantita < item.soglia_minima
              const expiryStatus = getExpiryStatus(item.scadenza)
              const riordinato = localRiordini.includes(item.id)
              const rowBg = isAlert
                ? 'bg-red-400/5'
                : expiryStatus === 'expired' ? 'bg-red-400/5'
                : expiryStatus === 'expiring' ? 'bg-amber-400/5' : ''
              return (
                <tr key={item.id} className={rowBg}>
                  <td className="font-medium text-cream">{item.prodotto}</td>
                  <td className="text-stone">{item.categoria}</td>
                  <td>{item.diametro ? `ø${item.diametro}` : '—'}</td>
                  <td>{item.lunghezza ? `${item.lunghezza}mm` : '—'}</td>
                  <td className="font-medium">{item.quantita} {item.unita}</td>
                  <td className={
                    expiryStatus === 'expired' ? 'text-red-400 font-medium' :
                    expiryStatus === 'expiring' ? 'text-amber-400 font-medium' : 'text-stone'
                  }>
                    {item.scadenza ? formatDate(item.scadenza) : '—'}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {isAlert && (
                        <span className="badge-alert flex items-center gap-1"><AlertTriangle size={10} /> Sotto soglia</span>
                      )}
                      {expiryStatus === 'expired' && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 border border-red-400/20 w-fit">
                          <AlertCircle size={10} /> Scaduto
                        </span>
                      )}
                      {expiryStatus === 'expiring' && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/20 w-fit">
                          <Clock size={10} /> In scadenza
                        </span>
                      )}
                      {!isAlert && expiryStatus !== 'expired' && expiryStatus !== 'expiring' && (
                        <span className="badge-ok flex items-center gap-1"><CheckCircle size={10} /> OK</span>
                      )}
                    </div>
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
