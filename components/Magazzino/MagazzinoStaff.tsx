'use client'

import { useState, useTransition } from 'react'
import { MagazzinoItem, Fornitore } from '@/types'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle, ShoppingCart, Check, Clock, AlertCircle, Phone, Mail, BellOff } from 'lucide-react'

// Barra copertura scorte (read-only, staff)
function CoperturaBarra({ quantita, soglia_minima, silenziato }: {
  quantita: number; soglia_minima: number; silenziato: boolean
}) {
  if (soglia_minima === 0) return null
  const perc = Math.min(100, Math.round((quantita / soglia_minima) * 100))
  let barClass: string
  if (silenziato) { barClass = 'bg-stone/50' }
  else if (perc <= 25) { barClass = 'bg-red-700' }
  else if (perc <= 60) { barClass = 'bg-amber-600' }
  else if (perc < 100) { barClass = 'bg-gold' }
  else { barClass = 'bg-emerald-600' }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="w-12 h-1 bg-stone/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${silenziato ? 100 : perc}%` }} />
      </div>
      <span className="text-[9px] text-stone/40">{silenziato ? '—' : `${perc}%`}</span>
    </div>
  )
}
import { useRouter } from 'next/navigation'

/** Etichetta relativa per ultimo_movimento_at */
function ultimoMovimentoLabel(ultimoMovimentoAt: string | null | undefined): string {
  if (!ultimoMovimentoAt) return 'non disponibile'
  const daysAgo = Math.floor((Date.now() - new Date(ultimoMovimentoAt).getTime()) / 86_400_000)
  if (daysAgo === 0) return 'oggi'
  if (daysAgo === 1) return 'ieri'
  return `${daysAgo} gg fa`
}

/** Prodotto dormiente se senza movimenti quantità da ≥ X giorni */
function isDormiente(item: MagazzinoItem, giorniDormiente: number): boolean {
  const ref = item.ultimo_movimento_at ?? item.created_at
  const daysAgo = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
  return daysAgo >= giorniDormiente
}

// Stili badge priorità (solo critica e alta sono visibili di default)
const PRIORITA_BADGE: Record<string, string> = {
  critica: 'bg-red-700/10 text-red-700 border-red-700/20',
  alta:    'bg-amber-600/10 text-amber-700 border-amber-600/20',
}

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
  fornitori: Fornitore[]
  giorniDormiente?: number
}

const CATEGORIE = [
  'Tutte', 'Impianti', 'Componentistica Protesica', 'Materiali Chirurgici',
  'Consumabili', 'DPI & Sterilizzazione'
]

export default function MagazzinoStaff({ items, riordiniAperti, userId, fornitori, giorniDormiente = 180 }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [categoria, setCategoria] = useState('Tutte')
  const [soloAlert, setSoloAlert] = useState(false)
  const [soloScadenza, setSoloScadenza] = useState(false)
  const [riordineNote, setRiordineNote] = useState<Record<string, string>>({})
  const [localRiordini, setLocalRiordini] = useState<string[]>(riordiniAperti)

  const filtered = items.filter(item => {
    if (categoria !== 'Tutte' && item.categoria !== categoria) return false
    // soloAlert esclude i prodotti con alert silenziato (non sono emergenze reali)
    if (soloAlert && (item.quantita >= item.soglia_minima || item.alert_silenziato)) return false
    if (soloScadenza) {
      const es = getExpiryStatus(item.scadenza)
      if (es === 'ok' || es === 'none') return false
    }
    return true
  })

  // alertCount: solo prodotti veramente in alert (sotto soglia E non silenziati)
  const alertCount = items.filter(i => i.quantita < i.soglia_minima && !i.alert_silenziato).length
  const scadenzaCount = items.filter(i => {
    const es = getExpiryStatus(i.scadenza)
    return es === 'expired' || es === 'expiring'
  }).length

  async function richiediRiordine(itemId: string) {
    await fetch('/api/magazzino/riordini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magazzino_id: itemId, note: riordineNote[itemId] || null }),
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
                      : 'border-stone/30 text-stone hover:border-stone hover:text-obsidian'
                  }`}>
            {cat}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => { setSoloAlert(!soloAlert); setSoloScadenza(false) }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                    soloAlert
                      ? 'bg-red-400/10 text-red-400 border-red-400/30'
                      : 'border-stone/30 text-stone hover:border-stone hover:text-obsidian'
                  }`}>
            <AlertTriangle size={11} />
            Sotto soglia ({alertCount})
          </button>
          <button onClick={() => { setSoloScadenza(!soloScadenza); setSoloAlert(false) }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                    soloScadenza
                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                      : 'border-stone/30 text-stone hover:border-stone hover:text-obsidian'
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
              <th>Fornitore</th>
              <th>Riordina</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-stone py-8">Nessun prodotto</td></tr>
            ) : filtered.map(item => {
              const isSilenziato = item.alert_silenziato
              const isAlert = item.quantita < item.soglia_minima && !isSilenziato
              const expiryStatus = getExpiryStatus(item.scadenza)
              const riordinato = localRiordini.includes(item.id)
              const dormiente = isDormiente(item, giorniDormiente)
              const ultMov = ultimoMovimentoLabel(item.ultimo_movimento_at)
              const rowBg = isAlert
                ? 'bg-red-400/5'
                : isSilenziato ? 'bg-stone/5'
                : expiryStatus === 'expired' ? 'bg-red-400/5'
                : expiryStatus === 'expiring' ? 'bg-amber-400/5' : ''
              return (
                <tr key={item.id} className={rowBg}>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-obsidian">{item.prodotto}</span>
                      {PRIORITA_BADGE[item.priorita] && (
                        <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded border w-fit font-medium capitalize ${PRIORITA_BADGE[item.priorita]}`}>
                          {item.priorita}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-stone">{item.categoria}</td>
                  <td>{item.diametro ? `ø${item.diametro}` : '—'}</td>
                  <td>{item.lunghezza ? `${item.lunghezza}mm` : '—'}</td>
                  <td>
                    <span className="font-medium">{item.quantita} {item.unita}</span>
                    <CoperturaBarra
                      quantita={item.quantita}
                      soglia_minima={item.soglia_minima}
                      silenziato={isSilenziato}
                    />
                    <p className="text-[9px] text-stone/40 mt-0.5">Mov: {ultMov}</p>
                  </td>
                  <td className={
                    expiryStatus === 'expired' ? 'text-red-700 font-medium' :
                    expiryStatus === 'expiring' ? 'text-amber-400 font-medium' : 'text-stone'
                  }>
                    {item.scadenza ? formatDate(item.scadenza) : '—'}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {isSilenziato && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-stone/10 text-stone border border-stone/20 w-fit">
                          <BellOff size={9} /> Silenziato
                        </span>
                      )}
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
                      {!isSilenziato && !isAlert && expiryStatus !== 'expired' && expiryStatus !== 'expiring' && (
                        <span className="badge-ok flex items-center gap-1"><CheckCircle size={10} /> OK</span>
                      )}
                      {dormiente && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-700 border border-amber-400/20 w-fit">
                          <Clock size={9} /> Dormiente
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Fornitore — read-only per staff */}
                  <td>
                    {(() => {
                      const f = fornitori.find(f => f.id === item.fornitore_id)
                      if (!f) return <span className="text-stone/40">—</span>
                      const contatto = f.fornitore_contatti?.find(c => c.is_predefinito)
                        ?? f.fornitore_contatti?.[0]
                      return (
                        <div className="space-y-0.5">
                          <p className="text-xs text-obsidian/80 font-medium">{f.nome}</p>
                          {contatto?.telefono && (
                            <a
                              href={`tel:${contatto.telefono}`}
                              className="flex items-center gap-1 text-[10px] text-stone/60 hover:text-gold transition-colors"
                            >
                              <Phone size={9} /> {contatto.telefono}
                            </a>
                          )}
                          {contatto?.email && (
                            <a
                              href={`mailto:${contatto.email}`}
                              className="flex items-center gap-1 text-[10px] text-stone/60 hover:text-gold transition-colors"
                            >
                              <Mail size={9} /> {contatto.email}
                            </a>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td>
                    {riordinato ? (
                      <span className="flex items-center gap-1 text-xs text-green-700">
                        <Check size={11} /> Segnalato
                      </span>
                    ) : (
                      <button
                        onClick={() => richiediRiordine(item.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                          isAlert
                            ? 'border-gold/40 text-gold hover:bg-gold/10'
                            : 'border-stone/30 text-stone hover:border-stone hover:text-obsidian'
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
