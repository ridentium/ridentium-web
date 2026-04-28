'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AgendaEvent, AgendaTipo } from '@/types/agenda'
import { CATEGORIA_LABEL, CATEGORIA_COLOR, calcolaStato } from '@/types/adempimenti'
import type { CategoriaAdempimento } from '@/types/adempimenti'
import {
  CheckSquare, RefreshCw, ShieldCheck, AlertTriangle, Clock,
  ChevronRight, Filter, Users, User, CalendarDays, Tag,
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function diffDays(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(iso + 'T00:00:00')
  return Math.ceil((target.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24))
}

function scadenzaLabel(data: string | null): { text: string; color: string } {
  const days = diffDays(data)
  if (days === null) return { text: '', color: '' }
  if (days < 0) return { text: `scaduto da ${Math.abs(days)}g`, color: 'text-red-400' }
  if (days === 0) return { text: 'oggi', color: 'text-red-400' }
  if (days === 1) return { text: 'domani', color: 'text-amber-400' }
  if (days <= 7) return { text: `fra ${days} giorni`, color: 'text-amber-400' }
  if (days <= 30) return { text: `fra ${days} giorni`, color: 'text-stone' }
  return { text: formatData(data), color: 'text-stone' }
}

const TIPO_CONFIG: Record<AgendaTipo, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  task: {
    label: 'Task', icon: CheckSquare,
    color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20',
  },
  ricorrente: {
    label: 'Ricorrente', icon: RefreshCw,
    color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20',
  },
  adempimento: {
    label: 'Adempimento', icon: ShieldCheck,
    color: 'text-gold', bg: 'bg-gold/10 border-gold/20',
  },
}

const PRIORITA_COLOR: Record<string, string> = {
  alta: 'text-red-400',
  media: 'text-amber-400',
  bassa: 'text-stone',
}

const FREQ_LABEL: Record<string, string> = {
  giornaliero: 'Ogni giorno',
  settimanale: 'Ogni settimana',
  mensile: 'Ogni mese',
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  isAdmin: boolean
  userId: string
}

export default function AgendaView({ isAdmin, userId }: Props) {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [mostraTutti, setMostraTutti] = useState(isAdmin)
  const [tipoFilter, setTipoFilter] = useState<AgendaTipo | 'tutti'>('tutti')
  const [giorni, setGiorni] = useState(60)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        giorni: String(giorni),
        tutti: String(mostraTutti),
      })
      const r = await fetch(`/api/agenda?${params}`, { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setEvents(d.events ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [giorni, mostraTutti])

  useEffect(() => { load() }, [load])

  const filtered = events.filter(e => tipoFilter === 'tutti' || e.tipo === tipoFilter)

  // Separa: eventi con data (ordinati) + ricorrenti senza data
  const conData = filtered.filter(e => e.data !== null)
  const senzaData = filtered.filter(e => e.data === null)

  // Raggruppa per data
  const gruppi = new Map<string, AgendaEvent[]>()
  for (const e of conData) {
    const k = e.data!
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(e)
  }

  const oggi = new Date()
  const oggiStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`

  return (
    <div className="space-y-6">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtro tipo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['tutti', 'task', 'ricorrente', 'adempimento'] as const).map(t => {
            const cfg = t === 'tutti' ? null : TIPO_CONFIG[t]
            const Icon = cfg?.icon
            return (
              <button
                key={t}
                onClick={() => setTipoFilter(t)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  tipoFilter === t
                    ? (cfg ? `${cfg.bg} ${cfg.color}` : 'bg-gold/10 border-gold/30 text-gold')
                    : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                }`}
              >
                {Icon && <Icon size={11} />}
                {t === 'tutti' ? 'Tutti' : cfg!.label}
              </button>
            )
          })}
        </div>

        {/* Orizzonte temporale */}
        <div className="flex items-center gap-1.5 ml-auto">
          <CalendarDays size={12} className="text-stone" />
          <select
            className="input text-xs py-1 px-2"
            value={giorni}
            onChange={e => setGiorni(Number(e.target.value))}
          >
            <option value={14}>2 settimane</option>
            <option value={30}>1 mese</option>
            <option value={60}>2 mesi</option>
            <option value={90}>3 mesi</option>
            <option value={180}>6 mesi</option>
          </select>
        </div>

        {/* Filtro visibilità (solo admin/manager) */}
        {isAdmin && (
          <button
            onClick={() => setMostraTutti(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
              mostraTutti
                ? 'bg-stone/10 border-stone/30 text-cream'
                : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
            }`}
          >
            {mostraTutti ? <Users size={11} /> : <User size={11} />}
            {mostraTutti ? 'Tutto il team' : 'Solo miei'}
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-stone text-sm">Caricamento agenda…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center py-10 text-stone text-sm">
          Nessun evento nel periodo selezionato.
        </div>
      )}

      {!loading && (
        <>
          {/* ── Ricorrenti (senza data fissa) ── */}
          {senzaData.length > 0 && (tipoFilter === 'tutti' || tipoFilter === 'ricorrente') && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-stone/60 mb-3">
                Azioni ricorrenti
              </h2>
              <div className="card p-0 divide-y divide-obsidian-light/30">
                {senzaData.map(e => (
                  <EventRow key={e.id} event={e} userId={userId} />
                ))}
              </div>
            </section>
          )}

          {/* ── Scadenze per data ── */}
          {conData.length > 0 && (
            <section className="space-y-4">
              {Array.from(gruppi.entries()).map(([data, evs]) => {
                const isOggi = data === oggiStr
                const days = diffDays(data)
                const passato = (days ?? 0) < 0
                return (
                  <div key={data}>
                    <div className={`flex items-center gap-2 mb-2 ${isOggi ? 'text-red-400' : passato ? 'text-red-400/70' : 'text-stone'}`}>
                      <span className="text-xs uppercase tracking-widest font-medium">
                        {isOggi ? '🔴 OGGI' : formatData(data)}
                      </span>
                      {passato && !isOggi && (
                        <span className="text-[10px] text-red-400/70">scaduto</span>
                      )}
                    </div>
                    <div className="card p-0 divide-y divide-obsidian-light/30">
                      {evs.map(e => (
                        <EventRow key={e.id} event={e} userId={userId} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

function EventRow({ event: e, userId }: { event: AgendaEvent; userId: string }) {
  const cfg = TIPO_CONFIG[e.tipo]
  const Icon = cfg.icon
  const scad = scadenzaLabel(e.data)
  const isOwn = e.assegnato_a_id === userId || !e.assegnato_a_id

  return (
    <Link
      href={e.href}
      className="flex items-start gap-3 px-4 py-3 hover:bg-obsidian-light/20 transition-colors group"
    >
      {/* Icona tipo */}
      <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${cfg.bg}`}>
        <Icon size={12} className={cfg.color} />
      </div>

      {/* Contenuto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={`text-sm font-medium truncate ${isOwn ? 'text-cream' : 'text-cream/70'}`}>
            {e.titolo}
          </p>
          {/* Evidenzia se è mio */}
          {isOwn && e.tipo !== 'ricorrente' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80 border border-gold/20 flex-shrink-0">
              mio
            </span>
          )}
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {/* Tipo pill */}
          <span className={`text-[10px] flex items-center gap-1 ${cfg.color}`}>
            <Icon size={9} /> {cfg.label}
          </span>

          {/* Frequenza (ricorrenti) */}
          {e.tipo === 'ricorrente' && e.frequenza && (
            <span className="text-[10px] text-stone flex items-center gap-1">
              <RefreshCw size={9} /> {FREQ_LABEL[e.frequenza] ?? e.frequenza}
            </span>
          )}

          {/* Categoria (adempimenti) */}
          {e.tipo === 'adempimento' && e.categoria && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: CATEGORIA_COLOR[e.categoria as CategoriaAdempimento] ?? '#A0907E' }}>
              <Tag size={9} /> {CATEGORIA_LABEL[e.categoria as CategoriaAdempimento] ?? e.categoria}
            </span>
          )}

          {/* Priorità (task) */}
          {e.tipo === 'task' && e.priorita && (
            <span className={`text-[10px] flex items-center gap-1 ${PRIORITA_COLOR[e.priorita]}`}>
              <AlertTriangle size={9} /> {e.priorita}
            </span>
          )}

          {/* Stato (task) */}
          {e.tipo === 'task' && e.stato && (
            <span className="text-[10px] text-stone capitalize">
              {e.stato.replace('_', ' ')}
            </span>
          )}

          {/* Assegnato a */}
          {e.assegnato_a_nome && (
            <span className="text-[10px] text-stone flex items-center gap-1">
              <User size={9} /> {e.assegnato_a_nome}
            </span>
          )}

          {/* Scadenza */}
          {scad.text && (
            <span className={`text-[10px] flex items-center gap-1 ${scad.color}`}>
              <Clock size={9} /> {scad.text}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={13} className="text-stone/30 group-hover:text-stone transition-colors flex-shrink-0 mt-1" />
    </Link>
  )
}
