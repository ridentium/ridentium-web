'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { AgendaEvent, AgendaTipo } from '@/types/agenda'
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from '@/types/adempimenti'
import type { CategoriaAdempimento } from '@/types/adempimenti'
import {
  CheckSquare, RefreshCw, ShieldCheck, AlertTriangle, Clock,
  ChevronRight, ChevronLeft, Users, User, CalendarDays, Tag,
  Plus, List, Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profilo {
  id: string
  nome: string
  cognome: string
  ruolo: string
}

type Tab = 'lista' | 'calendario' | 'aggiungi'
type TipoNuovo = 'task' | 'ricorrente' | 'adempimento'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<AgendaTipo, {
  label: string; icon: React.ElementType; color: string; bg: string; dot: string
}> = {
  task: {
    label: 'Task', icon: CheckSquare,
    color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', dot: '#60A5FA',
  },
  ricorrente: {
    label: 'Ricorrente', icon: RefreshCw,
    color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: '#34D399',
  },
  adempimento: {
    label: 'Adempimento', icon: ShieldCheck,
    color: 'text-gold', bg: 'bg-gold/10 border-gold/20', dot: '#C9A84C',
  },
}

const RUOLO_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  aso: 'ASO',
  segretaria: 'Segreteria',
  clinico: 'Clinico',
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
  trimestrale: 'Ogni trimestre',
  semestrale: 'Ogni semestre',
  annuale: 'Ogni anno',
  biennale: 'Ogni 2 anni',
  triennale: 'Ogni 3 anni',
  quinquennale: 'Ogni 5 anni',
}

const MESI_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const GIORNI_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

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

// ─── AgendaView (main) ────────────────────────────────────────────────────────

interface Props {
  isAdmin: boolean
  userId: string
}

export default function AgendaView({ isAdmin, userId }: Props) {
  const [tab, setTab] = useState<Tab>('lista')
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [profili, setProfili] = useState<Profilo[]>([])
  const [loading, setLoading] = useState(true)

  // Lista filters
  const [mostraTutti, setMostraTutti] = useState(isAdmin)
  const [tipoFilter, setTipoFilter] = useState<AgendaTipo | 'tutti'>('tutti')

  // Calendario state
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const oggiStr = toISO(now.getFullYear(), now.getMonth(), now.getDate())

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ giorni: '180', tutti: String(mostraTutti) })
      const r = await fetch(`/api/agenda?${params}`, { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setEvents(d.events ?? [])
        setProfili(d.profili ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [mostraTutti])

  useEffect(() => { load() }, [load])

  // ── Lista ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    events.filter(e => tipoFilter === 'tutti' || e.tipo === tipoFilter),
    [events, tipoFilter],
  )

  const conData = useMemo(() => filtered.filter(e => e.data !== null), [filtered])
  const senzaData = useMemo(() => filtered.filter(e => e.data === null), [filtered])

  const gruppi = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>()
    for (const e of conData) {
      const k = e.data!
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return m
  }, [conData])

  // ── Calendario ────────────────────────────────────────────────────────────
  const dayEventMap = useMemo(() => {
    const prefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-`
    const m = new Map<string, AgendaEvent[]>()
    for (const e of events) {
      if (!e.data?.startsWith(prefix)) continue
      const k = e.data!
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return m
  }, [events, calYear, calMonth])

  const calGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6
    const cells: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calYear, calMonth])

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedDayEvents = selectedDay ? (dayEventMap.get(selectedDay) ?? []) : []

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Tab nav ── */}
      <div className="flex items-center border-b border-obsidian-light">
        {([
          { id: 'lista', label: 'Lista', Icon: List },
          { id: 'calendario', label: 'Calendario', Icon: CalendarDays },
          { id: 'aggiungi', label: 'Aggiungi', Icon: Plus },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-gold text-gold'
                : 'border-transparent text-stone hover:text-cream'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && tab !== 'aggiungi' && (
        <div className="flex items-center justify-center gap-2 py-12 text-stone text-sm">
          <Loader2 size={16} className="animate-spin" />
          Caricamento agenda…
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ LISTA ════ */}
      {tab === 'lista' && !loading && (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tipo filter */}
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
                        ? cfg ? `${cfg.bg} ${cfg.color}` : 'bg-gold/10 border-gold/30 text-gold'
                        : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                    }`}
                  >
                    {Icon && <Icon size={11} />}
                    {t === 'tutti' ? 'Tutti' : cfg!.label}
                  </button>
                )
              })}
            </div>

            {/* Visibilità (solo admin) */}
            {isAdmin && (
              <button
                onClick={() => setMostraTutti(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ml-auto ${
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

          {filtered.length === 0 && (
            <div className="card text-center py-10 text-stone text-sm">
              Nessun evento nel periodo selezionato.
            </div>
          )}

          {/* Ricorrenti senza data */}
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

          {/* Scadenze per data */}
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════ CALENDARIO ════ */}
      {tab === 'calendario' && !loading && (
        <div className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-cream transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-medium text-cream tracking-wide">
              {MESI_IT[calMonth]} {calYear}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-cream transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Grid header */}
          <div className="card p-3">
            <div className="grid grid-cols-7 mb-1">
              {GIORNI_IT.map(g => (
                <div key={g} className="text-center text-[10px] uppercase tracking-wider text-stone/60 py-1">
                  {g}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {calGrid.map((day, idx) => {
                if (!day) return <div key={idx} />
                const iso = toISO(calYear, calMonth, day)
                const dayEvs = dayEventMap.get(iso) ?? []
                const isOggi = iso === oggiStr
                const isSelected = iso === selectedDay
                const hasPast = diffDays(iso) !== null && (diffDays(iso) ?? 0) < 0

                // Collect unique tipos for dots
                const tipos = Array.from(new Set<AgendaTipo>(dayEvs.map(e => e.tipo)))

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : iso)}
                    className={`relative flex flex-col items-center rounded py-1.5 px-0.5 transition-colors min-h-[52px] ${
                      isSelected
                        ? 'bg-gold/20 ring-1 ring-gold/50'
                        : isOggi
                        ? 'bg-red-400/10 ring-1 ring-red-400/30'
                        : dayEvs.length > 0
                        ? 'hover:bg-obsidian-light/30'
                        : 'hover:bg-obsidian-light/10'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
                      isOggi ? 'text-red-400' : isSelected ? 'text-gold' : hasPast ? 'text-stone/50' : 'text-cream/80'
                    }`}>
                      {day}
                    </span>
                    {/* Event dots */}
                    {tipos.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                        {tipos.map(tipo => (
                          <span
                            key={tipo}
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: TIPO_CONFIG[tipo].dot }}
                          />
                        ))}
                      </div>
                    )}
                    {/* Count if many */}
                    {dayEvs.length > 2 && (
                      <span className="text-[9px] text-stone/60 mt-0.5">{dayEvs.length}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-obsidian-light/30">
              {(['task', 'ricorrente', 'adempimento'] as const).map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIPO_CONFIG[t].dot }} />
                  <span className="text-[10px] text-stone/70">{TIPO_CONFIG[t].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-widest text-stone/60">
                {formatData(selectedDay)}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <div className="card py-6 text-center text-stone text-sm">
                  Nessun evento in questa data.
                </div>
              ) : (
                <div className="card p-0 divide-y divide-obsidian-light/30">
                  {selectedDayEvents.map(e => (
                    <EventRow key={e.id} event={e} userId={userId} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Month summary */}
          {!selectedDay && (
            <div className="card">
              <p className="text-xs text-stone/60 mb-3 uppercase tracking-wider">
                Riepilogo {MESI_IT[calMonth]}
              </p>
              {dayEventMap.size === 0 ? (
                <p className="text-sm text-stone text-center py-4">Nessun evento questo mese.</p>
              ) : (
                <div className="space-y-1">
                  {Array.from(dayEventMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([iso, evs]) => {
                      const isOggi = iso === oggiStr
                      const days = diffDays(iso)
                      const passato = (days ?? 0) < 0
                      return (
                        <button
                          key={iso}
                          onClick={() => setSelectedDay(iso)}
                          className="w-full flex items-center gap-3 py-2 px-1 rounded hover:bg-obsidian-light/20 transition-colors text-left"
                        >
                          <span className={`text-xs font-medium w-24 flex-shrink-0 ${
                            isOggi ? 'text-red-400' : passato ? 'text-stone/50' : 'text-stone'
                          }`}>
                            {isOggi ? '🔴 Oggi' : formatData(iso)}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {evs.map((e, i) => {
                              const cfg = TIPO_CONFIG[e.tipo]
                              const Icon = cfg.icon
                              return (
                                <span key={i} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                                  <Icon size={9} />
                                  {e.titolo.length > 30 ? e.titolo.slice(0, 30) + '…' : e.titolo}
                                </span>
                              )
                            })}
                          </div>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════ AGGIUNGI ════ */}
      {tab === 'aggiungi' && (
        <AggiungiPanel
          isAdmin={isAdmin}
          userId={userId}
          profili={profili}
          loading={loading}
          onSuccess={() => { load(); setTab('lista') }}
        />
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
          {isOwn && e.tipo !== 'ricorrente' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80 border border-gold/20 flex-shrink-0">
              mio
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <span className={`text-[10px] flex items-center gap-1 ${cfg.color}`}>
            <Icon size={9} /> {cfg.label}
          </span>
          {e.tipo === 'ricorrente' && e.frequenza && (
            <span className="text-[10px] text-stone flex items-center gap-1">
              <RefreshCw size={9} /> {FREQ_LABEL[e.frequenza] ?? e.frequenza}
            </span>
          )}
          {e.tipo === 'adempimento' && e.categoria && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: CATEGORIA_COLOR[e.categoria as CategoriaAdempimento] ?? '#A0907E' }}>
              <Tag size={9} /> {CATEGORIA_LABEL[e.categoria as CategoriaAdempimento] ?? e.categoria}
            </span>
          )}
          {e.tipo === 'task' && e.priorita && (
            <span className={`text-[10px] flex items-center gap-1 ${PRIORITA_COLOR[e.priorita]}`}>
              <AlertTriangle size={9} /> {e.priorita}
            </span>
          )}
          {e.tipo === 'task' && e.stato && (
            <span className="text-[10px] text-stone capitalize">
              {e.stato.replace('_', ' ')}
            </span>
          )}
          {e.assegnato_a_nome && (
            <span className="text-[10px] text-stone flex items-center gap-1">
              <User size={9} /> {e.assegnato_a_nome}
            </span>
          )}
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

// ─── AggiungiPanel ────────────────────────────────────────────────────────────

interface AggiungiPanelProps {
  isAdmin: boolean
  userId: string
  profili: Profilo[]
  loading: boolean
  onSuccess: () => void
}

function AggiungiPanel({ isAdmin, userId, profili, loading: parentLoading, onSuccess }: AggiungiPanelProps) {
  const [tipo, setTipo] = useState<TipoNuovo>('task')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState(false)

  // Common
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')

  // Task
  const [priorita, setPriorita] = useState<'bassa' | 'media' | 'alta'>('media')
  const [scadenza, setScadenza] = useState('')

  // Task + Ricorrente — assegnee
  const [assegnaMode, setAssegnaMode] = useState<'io' | 'altro'>('io')
  const [filtroRuolo, setFiltroRuolo] = useState<string>('')
  const [assegnatoA, setAssegnatoA] = useState<string>('')

  // Ricorrente
  const [frequenzaRic, setFrequenzaRic] = useState<'giornaliero' | 'settimanale' | 'mensile'>('settimanale')
  const [assegnaTutti, setAssegnaTutti] = useState(false)

  // Adempimento
  const [categoriaAd, setCategoriaAd] = useState<CategoriaAdempimento>('altro')
  const [frequenzaAd, setFrequenzaAd] = useState('annuale')
  const [scadenzaAd, setScadenzaAd] = useState('')
  const [preavvisoGiorni, setPreavvisoGiorni] = useState(30)
  const [respMode, setRespMode] = useState<'profilo' | 'etichetta'>('profilo')
  const [respProfiloId, setRespProfiloId] = useState('')
  const [respEtichetta, setRespEtichetta] = useState('')

  const ruoliDisponibili = useMemo(() =>
    Array.from(new Set(profili.map(p => p.ruolo))).sort(),
    [profili],
  )

  const profiliFiltrati = useMemo(() =>
    filtroRuolo ? profili.filter(p => p.ruolo === filtroRuolo) : profili,
    [profili, filtroRuolo],
  )

  // Reset form when tipo changes
  function resetForm() {
    setTitolo(''); setDescrizione(''); setPriorita('media'); setScadenza('')
    setAssegnaMode('io'); setFiltroRuolo(''); setAssegnatoA('')
    setFrequenzaRic('settimanale'); setAssegnaTutti(false)
    setCategoriaAd('altro'); setFrequenzaAd('annuale'); setScadenzaAd('')
    setPreavvisoGiorni(30); setRespMode('profilo'); setRespProfiloId(''); setRespEtichetta('')
    setErrore(null); setSuccesso(false)
  }

  function changeTipo(t: TipoNuovo) {
    setTipo(t)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titolo.trim()) { setErrore('Il titolo è obbligatorio'); return }
    setSaving(true); setErrore(null); setSuccesso(false)

    try {
      let url = ''
      let body: Record<string, unknown> = {}

      if (tipo === 'task') {
        url = '/api/tasks'
        body = {
          titolo: titolo.trim(),
          descrizione: descrizione.trim() || undefined,
          priorita,
          scadenza: scadenza || undefined,
          assegnato_a: assegnaMode === 'io' ? userId : (assegnatoA || userId),
        }
      } else if (tipo === 'ricorrente') {
        url = '/api/ricorrenti'
        body = {
          titolo: titolo.trim(),
          descrizione: descrizione.trim() || undefined,
          frequenza: frequenzaRic,
          assegnato_a: assegnaTutti ? null : (assegnaMode === 'io' ? userId : (assegnatoA || null)),
        }
      } else if (tipo === 'adempimento') {
        url = '/api/adempimenti'
        body = {
          titolo: titolo.trim(),
          descrizione: descrizione.trim() || undefined,
          categoria: categoriaAd,
          frequenza: frequenzaAd,
          prossima_scadenza: scadenzaAd || null,
          preavviso_giorni: preavvisoGiorni,
          responsabile_profilo_id: respMode === 'profilo' ? (respProfiloId || null) : null,
          responsabile_etichetta: respMode === 'etichetta' ? (respEtichetta.trim() || null) : null,
        }
      }

      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await r.json()
      if (!r.ok) {
        setErrore(data.error ?? 'Errore durante il salvataggio')
      } else {
        setSuccesso(true)
        setTimeout(() => {
          onSuccess()
        }, 800)
      }
    } catch {
      setErrore('Errore di rete')
    } finally {
      setSaving(false)
    }
  }

  // Assignee selector component (shared between task + ricorrente)
  function AssigneeSelector({ showTutti = false }: { showTutti?: boolean }) {
    return (
      <div className="space-y-3">
        <label className="block text-xs text-stone uppercase tracking-wider">Assegna a</label>
        {showTutti && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={assegnaTutti}
              onChange={e => { setAssegnaTutti(e.target.checked); setAssegnaMode('io') }}
              className="w-4 h-4 accent-gold"
            />
            <span className="text-sm text-cream">Tutti (nessuno assegnato in specifico)</span>
          </label>
        )}
        {(!showTutti || !assegnaTutti) && (
          <>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setAssegnaMode('io'); setAssegnatoA('') }}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${assegnaMode === 'io' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}
                >
                  <User size={10} className="inline mr-1" />A me
                </button>
                <button
                  type="button"
                  onClick={() => setAssegnaMode('altro')}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${assegnaMode === 'altro' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}
                >
                  <Users size={10} className="inline mr-1" />Altra persona
                </button>
              </div>
            )}
            {(assegnaMode === 'altro' || !isAdmin) && (
              <div className="flex gap-2">
                {isAdmin && (
                  <select
                    className="input text-xs py-1.5 px-2 w-36"
                    value={filtroRuolo}
                    onChange={e => { setFiltroRuolo(e.target.value); setAssegnatoA('') }}
                  >
                    <option value="">Tutti i ruoli</option>
                    {ruoliDisponibili.map(r => (
                      <option key={r} value={r}>{RUOLO_LABEL[r] ?? r}</option>
                    ))}
                  </select>
                )}
                <select
                  className="input text-xs py-1.5 px-2 flex-1"
                  value={assegnatoA}
                  onChange={e => setAssegnatoA(e.target.value)}
                  required
                >
                  <option value="">— Scegli persona —</option>
                  {profiliFiltrati.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (parentLoading && profili.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-stone text-sm">
        <Loader2 size={16} className="animate-spin" />
        Caricamento…
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      {/* Tipo selector */}
      <div className="card mb-6">
        <p className="text-xs uppercase tracking-wider text-stone/60 mb-3">Tipo di elemento</p>
        <div className="grid grid-cols-3 gap-2">
          {(['task', 'ricorrente', 'adempimento'] as const).map(t => {
            const cfg = TIPO_CONFIG[t]
            const Icon = cfg.icon
            const canCreate = t === 'task' ? true : isAdmin
            return (
              <button
                key={t}
                type="button"
                disabled={!canCreate}
                onClick={() => changeTipo(t)}
                className={`flex flex-col items-center gap-2 p-3 rounded border transition-colors ${
                  tipo === t
                    ? `${cfg.bg} ${cfg.color}`
                    : canCreate
                    ? 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                    : 'border-obsidian-light/40 text-stone/30 cursor-not-allowed'
                }`}
              >
                <Icon size={18} />
                <span className="text-xs font-medium">{cfg.label}</span>
              </button>
            )
          })}
        </div>
        {(tipo === 'adempimento' || tipo === 'ricorrente') && !isAdmin && (
          <p className="text-[10px] text-stone/60 mt-2">
            Solo admin e manager possono creare {tipo === 'adempimento' ? 'adempimenti' : 'azioni ricorrenti'}.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Titolo */}
        <div>
          <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">
            Titolo <span className="text-red-400">*</span>
          </label>
          <input
            className="input w-full"
            placeholder={
              tipo === 'task' ? 'Es. Chiamare fornitore materiali…' :
              tipo === 'ricorrente' ? 'Es. Controllo sterilizzatrice…' :
              'Es. Rinnovo assicurazione professionale…'
            }
            value={titolo}
            onChange={e => setTitolo(e.target.value)}
            required
          />
        </div>

        {/* Descrizione */}
        <div>
          <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">
            Descrizione (opzionale)
          </label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            placeholder="Note aggiuntive…"
            value={descrizione}
            onChange={e => setDescrizione(e.target.value)}
          />
        </div>

        {/* ── TASK fields ── */}
        {tipo === 'task' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Priorità</label>
                <select className="input w-full" value={priorita} onChange={e => setPriorita(e.target.value as typeof priorita)}>
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Scadenza</label>
                <input
                  type="date"
                  className="input w-full"
                  value={scadenza}
                  onChange={e => setScadenza(e.target.value)}
                />
              </div>
            </div>
            <AssigneeSelector />
          </>
        )}

        {/* ── RICORRENTE fields ── */}
        {tipo === 'ricorrente' && (
          <>
            <div>
              <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">
                Frequenza <span className="text-red-400">*</span>
              </label>
              <select
                className="input w-full"
                value={frequenzaRic}
                onChange={e => setFrequenzaRic(e.target.value as typeof frequenzaRic)}
              >
                <option value="giornaliero">Ogni giorno</option>
                <option value="settimanale">Ogni settimana</option>
                <option value="mensile">Ogni mese</option>
              </select>
            </div>
            <AssigneeSelector showTutti />
          </>
        )}

        {/* ── ADEMPIMENTO fields ── */}
        {tipo === 'adempimento' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">
                  Categoria <span className="text-red-400">*</span>
                </label>
                <select
                  className="input w-full"
                  value={categoriaAd}
                  onChange={e => setCategoriaAd(e.target.value as CategoriaAdempimento)}
                >
                  {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">
                  Frequenza <span className="text-red-400">*</span>
                </label>
                <select className="input w-full" value={frequenzaAd} onChange={e => setFrequenzaAd(e.target.value)}>
                  {Object.entries(FREQ_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Prossima scadenza</label>
                <input
                  type="date"
                  className="input w-full"
                  value={scadenzaAd}
                  onChange={e => setScadenzaAd(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Preavviso (giorni)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="input w-full"
                  value={preavvisoGiorni}
                  onChange={e => setPreavvisoGiorni(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Responsabile */}
            <div>
              <label className="block text-xs text-stone uppercase tracking-wider mb-2">Responsabile</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setRespMode('profilo')}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === 'profilo' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}
                >
                  <User size={10} className="inline mr-1" />Persona interna
                </button>
                <button
                  type="button"
                  onClick={() => setRespMode('etichetta')}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === 'etichetta' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}
                >
                  Etichetta libera
                </button>
              </div>
              {respMode === 'profilo' ? (
                <div className="flex gap-2">
                  <select
                    className="input text-xs py-1.5 px-2 w-36"
                    value={filtroRuolo}
                    onChange={e => { setFiltroRuolo(e.target.value); setRespProfiloId('') }}
                  >
                    <option value="">Tutti i ruoli</option>
                    {ruoliDisponibili.map(r => (
                      <option key={r} value={r}>{RUOLO_LABEL[r] ?? r}</option>
                    ))}
                  </select>
                  <select
                    className="input text-xs py-1.5 px-2 flex-1"
                    value={respProfiloId}
                    onChange={e => setRespProfiloId(e.target.value)}
                  >
                    <option value="">— Nessuno —</option>
                    {profiliFiltrati.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  className="input w-full"
                  placeholder="Es. Consulente esterno, Studio commercialista…"
                  value={respEtichetta}
                  onChange={e => setRespEtichetta(e.target.value)}
                />
              )}
            </div>
          </>
        )}

        {/* Error / success */}
        {errore && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
            {errore}
          </div>
        )}
        {successo && (
          <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-3 py-2">
            ✓ Salvato con successo!
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || successo}
            className="btn-primary flex items-center gap-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" />Salvataggio…</>
              : successo
              ? <><CheckSquare size={14} />Salvato!</>
              : <><Plus size={14} />Aggiungi {tipo === 'task' ? 'task' : tipo === 'ricorrente' ? 'ricorrente' : 'adempimento'}</>
            }
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm text-stone hover:text-cream transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}
