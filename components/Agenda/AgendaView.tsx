'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AgendaEvent, AgendaTipo } from '@/types/agenda'
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from '@/types/adempimenti'
import type { CategoriaAdempimento } from '@/types/adempimenti'
import Toast, { type ToastState } from '@/components/ui/Toast'
import TaskCommenti from '@/components/Tasks/TaskCommenti'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import {
  CheckSquare, RefreshCw, ShieldCheck, AlertTriangle, Clock,
  ChevronLeft, ChevronRight, Users, User, CalendarDays, Tag,
  Plus, List, Loader2, Pencil, Trash2, X, Check, Search,
  MoreHorizontal, ExternalLink,
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
  task:        { label: 'Task',         icon: CheckSquare, color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20',    dot: '#60A5FA' },
  ricorrente:  { label: 'Ricorrente',   icon: RefreshCw,   color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: '#34D399' },
  adempimento: { label: 'Adempimento',  icon: ShieldCheck, color: 'text-gold',        bg: 'bg-gold/10 border-gold/20',            dot: '#C9A84C' },
}

const RUOLO_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', aso: 'ASO', segretaria: 'Segreteria', clinico: 'Clinico',
}

const PRIORITA_COLOR: Record<string, string> = {
  alta: 'text-red-400', media: 'text-amber-400', bassa: 'text-stone',
}

const FREQ_LABEL: Record<string, string> = {
  giornaliero: 'Ogni giorno', settimanale: 'Ogni settimana', mensile: 'Ogni mese',
  trimestrale: 'Ogni trimestre', semestrale: 'Ogni semestre', annuale: 'Ogni anno',
  biennale: 'Ogni 2 anni', triennale: 'Ogni 3 anni', quinquennale: 'Ogni 5 anni',
}

const STATO_LABEL: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completato: 'Completato',
}

const STATO_COLOR: Record<string, string> = {
  da_fare:    'text-amber-400 border-amber-400/30 bg-amber-400/10',
  in_corso:   'text-blue-400 border-blue-400/30 bg-blue-400/10',
  completato: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
}

const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                 'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const GIORNI_IT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function diffDays(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000)
}

function scadenzaLabel(data: string | null): { text: string; color: string } {
  const days = diffDays(data)
  if (days === null) return { text: '', color: '' }
  if (days < 0)  return { text: `scaduto da ${Math.abs(days)}g`, color: 'text-red-400' }
  if (days === 0) return { text: 'oggi', color: 'text-red-400' }
  if (days === 1) return { text: 'domani', color: 'text-amber-400' }
  if (days <= 7)  return { text: `fra ${days} giorni`, color: 'text-amber-400' }
  if (days <= 30) return { text: `fra ${days} giorni`, color: 'text-stone' }
  return { text: formatData(data), color: 'text-stone' }
}

// ─── AgendaView ───────────────────────────────────────────────────────────────

interface Props { isAdmin: boolean; userId: string }

export default function AgendaView({ isAdmin, userId }: Props) {
  const [tab, setTab] = useState<Tab>('lista')
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [profili, setProfili] = useState<Profilo[]>([])
  const [loading, setLoading] = useState(true)

  // Lista
  const [mostraTutti, setMostraTutti] = useState(isAdmin)
  const [tipoFilter, setTipoFilter] = useState<AgendaTipo | 'tutti'>('tutti')
  const [search, setSearch] = useState('')
  const [soloAperti, setSoloAperti] = useState(false)

  // Calendario
  const now = new Date()
  const [calView, setCalView] = useState<'mese' | 'settimana'>('settimana')
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Settimana: lunedì della settimana corrente come ISO
  function getMondayISO(d: Date): string {
    const day = new Date(d)
    const dow = day.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    day.setDate(day.getDate() + offset)
    return toISO(day.getFullYear(), day.getMonth(), day.getDate())
  }
  const [weekStart, setWeekStart] = useState<string>(() => getMondayISO(now))

  function prevWeek() {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekStart(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  function nextWeek() {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setWeekStart(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  function goToCurrentWeek() { setWeekStart(getMondayISO(now)) }

  const weekDays = useMemo(() => {
    const days: string[] = []
    const d = new Date(weekStart + 'T00:00:00')
    for (let i = 0; i < 7; i++) {
      days.push(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [weekStart])

  const weekEventMap = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>()
    for (const d of weekDays) m.set(d, [])
    for (const e of events) {
      if (e.data && m.has(e.data)) m.get(e.data)!.push(e)
    }
    return m
  }, [events, weekDays])

  // Edit
  const [editTarget, setEditTarget] = useState<AgendaEvent | null>(null)

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  const oggiStr = toISO(now.getFullYear(), now.getMonth(), now.getDate())
  const supabase = useMemo(() => createBrowserClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/agenda?giorni=180&tutti=${mostraTutti}`, { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setEvents(d.events ?? [])
        setProfili(d.profili ?? [])
      }
    } finally { setLoading(false) }
  }, [mostraTutti])

  useEffect(() => { load() }, [load])

  // ── Realtime: aggiorna automaticamente quando cambiano task/adempimenti/ricorrenti ──
  useEffect(() => {
    const channel = supabase
      .channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ricorrenti' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adempimenti' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleDelete(event: AgendaEvent) {
    setEvents(prev => prev.filter(e => e.id !== event.id))
  }

  function handleStatoChange(id: string, nuovoStato: 'da_fare' | 'in_corso' | 'completato') {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, stato: nuovoStato } : e))
  }

  async function handleQuickComplete(event: AgendaEvent) {
    if (event.tipo === 'task') {
      if (event.stato === 'completato') return
      // Ottimistico: aggiorna subito la UI, poi rollback se l'API fallisce
      const prevStato = event.stato ?? 'da_fare'
      handleStatoChange(event.id, 'completato')
      const r = await fetch(`/api/tasks/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: 'completato' }),
      })
      if (r.ok) {
        showToast(`"${event.titolo}" segnato come fatto`)
      } else {
        handleStatoChange(event.id, prevStato as 'da_fare' | 'in_corso' | 'completato')
        showToast('Errore aggiornamento', 'error')
      }
    } else if (event.tipo === 'adempimento') {
      const r = await fetch(`/api/adempimenti/${event.id}/completa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (r.ok) {
        showToast(`"${event.titolo}" completato — scadenza rinnovata`)
        load()
      } else {
        showToast('Errore completamento adempimento', 'error')
      }
    }
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = events.filter(e => tipoFilter === 'tutti' || e.tipo === tipoFilter)
    if (soloAperti) {
      list = list.filter(e => e.tipo !== 'task' || e.stato !== 'completato')
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.titolo.toLowerCase().includes(q) ||
        (e.descrizione ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [events, tipoFilter, soloAperti, search])

  const conData = useMemo(() => filtered.filter(e => e.data !== null), [filtered])
  const senzaData = useMemo(() => filtered.filter(e => e.data === null), [filtered])
  const gruppi = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>()
    for (const e of conData) { if (!m.has(e.data!)) m.set(e.data!, []); m.get(e.data!)!.push(e) }
    return m
  }, [conData])

  // ── Calendario ─────────────────────────────────────────────────────────────
  const dayEventMap = useMemo(() => {
    const prefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-`
    const m = new Map<string, AgendaEvent[]>()
    for (const e of events) {
      if (!e.data?.startsWith(prefix)) continue
      if (!m.has(e.data!)) m.set(e.data!, [])
      m.get(e.data!)!.push(e)
    }
    return m
  }, [events, calYear, calMonth])

  const calGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    let startOffset = firstDay.getDay() - 1; if (startOffset < 0) startOffset = 6
    const cells: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calYear, calMonth])

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Row props shared
  const rowProps = {
    userId, isAdmin, profili,
    onEdit: setEditTarget,
    onDelete: handleDelete,
    onStatoChange: handleStatoChange,
    onQuickComplete: handleQuickComplete,
    onToast: showToast,
  }

  // ─ Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Tab nav */}
      <div className="flex items-center border-b border-obsidian-light">
        {([
          { id: 'lista', label: 'Lista', Icon: List },
          { id: 'calendario', label: 'Calendario', Icon: CalendarDays },
          { id: 'aggiungi', label: 'Aggiungi', Icon: Plus },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id ? 'border-gold text-gold' : 'border-transparent text-stone hover:text-cream'}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {loading && tab !== 'aggiungi' && (
        <div className="flex items-center justify-center gap-2 py-12 text-stone text-sm">
          <Loader2 size={16} className="animate-spin" />Caricamento agenda…
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ LISTA ══════ */}
      {tab === 'lista' && !loading && (
        <div className="space-y-5">

          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone/40 pointer-events-none" />
            <input
              className="input w-full pl-8 pr-8 text-sm"
              placeholder="Cerca nell'agenda…"
              value={search}
              onChange={ev => setSearch(ev.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone/40 hover:text-cream transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['tutti', 'task', 'ricorrente', 'adempimento'] as const).map(t => {
                const cfg = t === 'tutti' ? null : TIPO_CONFIG[t]
                const Icon = cfg?.icon
                return (
                  <button key={t} onClick={() => setTipoFilter(t)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                      tipoFilter === t
                        ? cfg ? `${cfg.bg} ${cfg.color}` : 'bg-gold/10 border-gold/30 text-gold'
                        : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'}`}>
                    {Icon && <Icon size={11} />}
                    {t === 'tutti' ? 'Tutti' : cfg!.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setSoloAperti(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  soloAperti
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                }`}
              >
                <Check size={11} />
                Da completare
              </button>
              {isAdmin && (
                <button onClick={() => setMostraTutti(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                    mostraTutti ? 'bg-stone/10 border-stone/30 text-cream' : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'}`}>
                  {mostraTutti ? <Users size={11} /> : <User size={11} />}
                  {mostraTutti ? 'Team' : 'Solo miei'}
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="card text-center py-10 text-stone text-sm">
              {search ? `Nessun risultato per "${search}".` : 'Nessun evento nel periodo selezionato.'}
            </div>
          )}

          {senzaData.length > 0 && (tipoFilter === 'tutti' || tipoFilter === 'ricorrente') && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-stone/60 mb-3">Azioni ricorrenti</h2>
              <div className="card p-0 divide-y divide-obsidian-light/30">
                {senzaData.map(e => <EventRow key={e.id} event={e} {...rowProps} />)}
              </div>
            </section>
          )}

          {conData.length > 0 && (
            <section className="space-y-4">
              {Array.from(gruppi.entries()).map(([data, evs]) => {
                const isOggi = data === oggiStr
                const passato = (diffDays(data) ?? 0) < 0
                return (
                  <div key={data}>
                    <div className={`flex items-center gap-2 mb-2 ${isOggi ? 'text-red-400' : passato ? 'text-red-400/70' : 'text-stone'}`}>
                      <span className="text-xs uppercase tracking-widest font-medium">
                        {isOggi ? '🔴 OGGI' : formatData(data)}
                      </span>
                      {passato && !isOggi && <span className="text-[10px] text-red-400/70">scaduto</span>}
                    </div>
                    <div className="card p-0 divide-y divide-obsidian-light/30">
                      {evs.map(e => <EventRow key={e.id} event={e} {...rowProps} />)}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ CALENDARIO ══════ */}
      {tab === 'calendario' && !loading && (
        <div className="space-y-4">
          {/* Toggle mese / settimana */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg overflow-hidden border border-obsidian-light/50">
              {(['settimana', 'mese'] as const).map(v => (
                <button key={v} onClick={() => setCalView(v)}
                  className={`text-xs px-3 py-1.5 transition-colors ${
                    calView === v ? 'bg-gold/20 text-gold' : 'text-stone hover:text-cream'
                  }`}>
                  {v === 'settimana' ? 'Settimana' : 'Mese'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Vista settimana ── */}
          {calView === 'settimana' && (() => {
            const weekEndDate = new Date(weekDays[6] + 'T00:00:00')
            const weekStartDate = new Date(weekDays[0] + 'T00:00:00')
            const isCurrentWeek = weekDays.includes(oggiStr)
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={prevWeek} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-cream transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-center">
                    <h2 className="text-sm font-medium text-cream">
                      {weekStartDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} –{' '}
                      {weekEndDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </h2>
                    {!isCurrentWeek && (
                      <button onClick={goToCurrentWeek} className="text-[10px] text-gold/60 hover:text-gold transition-colors mt-0.5">
                        → Vai a questa settimana
                      </button>
                    )}
                  </div>
                  <button onClick={nextWeek} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-cream transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((iso, i) => {
                    const d = new Date(iso + 'T00:00:00')
                    const dayEvs = weekEventMap.get(iso) ?? []
                    const isOggi = iso === oggiStr
                    const isPast = iso < oggiStr
                    return (
                      <div key={iso} className={`rounded-xl border p-2 min-h-[100px] transition-colors ${
                        isOggi ? 'border-red-400/30 bg-red-400/5' : 'border-obsidian-light/30 bg-obsidian-light/5'
                      }`}>
                        <div className="text-center mb-2">
                          <p className={`text-[9px] uppercase tracking-wider ${isOggi ? 'text-red-400' : 'text-stone/50'}`}>
                            {GIORNI_IT[i === 6 ? 6 : i]}
                          </p>
                          <p className={`text-sm font-medium ${isOggi ? 'text-red-400' : isPast ? 'text-stone/40' : 'text-cream/80'}`}>
                            {d.getDate()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {dayEvs.slice(0, 4).map(e => {
                            const cfg = TIPO_CONFIG[e.tipo]
                            const Icon = cfg.icon
                            const isCompleted = e.stato === 'completato'
                            const canFatto = (e.tipo === 'task' && !isCompleted) || e.tipo === 'adempimento'
                            return (
                              <div key={e.id}
                                className={`w-full flex items-center gap-0.5 text-[9px] rounded border transition-colors ${
                                  isCompleted ? 'opacity-40' : ''
                                } ${cfg.bg} ${cfg.color}`}
                              >
                                <button
                                  onClick={() => setEditTarget(e)}
                                  className="flex-1 flex items-center gap-1 px-1.5 py-1 min-w-0 hover:opacity-80 transition-opacity"
                                >
                                  <Icon size={8} className="flex-shrink-0" />
                                  <span className={`truncate ${isCompleted ? 'line-through' : ''}`}>{e.titolo}</span>
                                </button>
                                {canFatto && (
                                  <button
                                    onClick={async (ev) => { ev.stopPropagation(); await handleQuickComplete(e) }}
                                    title="Segna come fatto"
                                    className="flex-shrink-0 px-1 py-1 hover:bg-green-400/20 rounded-r transition-colors border-l border-current/20"
                                  >
                                    <Check size={7} />
                                  </button>
                                )}
                                {isCompleted && (
                                  <span className="flex-shrink-0 px-1 py-1">
                                    <Check size={7} className="text-green-400" />
                                  </span>
                                )}
                              </div>
                            )
                          })}
                          {dayEvs.length > 4 && (
                            <p className="text-[9px] text-stone/50 text-center">+{dayEvs.length - 4} altri</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legenda */}
                <div className="flex items-center gap-4">
                  {(['task', 'ricorrente', 'adempimento'] as const).map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIPO_CONFIG[t].dot }} />
                      <span className="text-[10px] text-stone/70">{TIPO_CONFIG[t].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── Vista mese ── */}
          {calView === 'mese' && (<>
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-cream transition-colors">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-medium text-cream tracking-wide">{MESI_IT[calMonth]} {calYear}</h2>
            <button onClick={nextMonth} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-cream transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="card p-3">
            <div className="grid grid-cols-7 mb-1">
              {GIORNI_IT.map(g => (
                <div key={g} className="text-center text-[10px] uppercase tracking-wider text-stone/60 py-1">{g}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calGrid.map((day, idx) => {
                if (!day) return <div key={idx} />
                const iso = toISO(calYear, calMonth, day)
                const dayEvs = dayEventMap.get(iso) ?? []
                const isOggi = iso === oggiStr
                const isSelected = iso === selectedDay
                const hasPast = (diffDays(iso) ?? 0) < 0
                const tipos = Array.from(new Set<AgendaTipo>(dayEvs.map(e => e.tipo)))
                return (
                  <button key={idx} onClick={() => setSelectedDay(isSelected ? null : iso)}
                    className={`flex flex-col items-center rounded py-1.5 px-0.5 transition-colors min-h-[52px] ${
                      isSelected ? 'bg-gold/20 ring-1 ring-gold/50'
                      : isOggi ? 'bg-red-400/10 ring-1 ring-red-400/30'
                      : dayEvs.length > 0 ? 'hover:bg-obsidian-light/30' : 'hover:bg-obsidian-light/10'}`}>
                    <span className={`text-xs font-medium ${isOggi ? 'text-red-400' : isSelected ? 'text-gold' : hasPast ? 'text-stone/50' : 'text-cream/80'}`}>
                      {day}
                    </span>
                    {tipos.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                        {tipos.map(tipo => (
                          <span key={tipo} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TIPO_CONFIG[tipo].dot }} />
                        ))}
                      </div>
                    )}
                    {dayEvs.length > 2 && <span className="text-[9px] text-stone/60 mt-0.5">{dayEvs.length}</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-obsidian-light/30">
              {(['task', 'ricorrente', 'adempimento'] as const).map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TIPO_CONFIG[t].dot }} />
                  <span className="text-[10px] text-stone/70">{TIPO_CONFIG[t].label}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedDay && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-widest text-stone/60">{formatData(selectedDay)}</h3>
              {(dayEventMap.get(selectedDay) ?? []).length === 0 ? (
                <div className="card py-6 text-center text-stone text-sm">Nessun evento in questa data.</div>
              ) : (
                <div className="card p-0 divide-y divide-obsidian-light/30">
                  {(dayEventMap.get(selectedDay) ?? []).map(e => <EventRow key={e.id} event={e} {...rowProps} />)}
                </div>
              )}
            </div>
          )}

          {!selectedDay && (
            <div className="card">
              <p className="text-xs text-stone/60 mb-3 uppercase tracking-wider">Riepilogo {MESI_IT[calMonth]}</p>
              {dayEventMap.size === 0 ? (
                <p className="text-sm text-stone text-center py-4">Nessun evento questo mese.</p>
              ) : (
                <div className="space-y-1">
                  {Array.from(dayEventMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([iso, evs]) => {
                    const isOggi = iso === oggiStr; const passato = (diffDays(iso) ?? 0) < 0
                    return (
                      <button key={iso} onClick={() => setSelectedDay(iso)}
                        className="w-full flex items-center gap-3 py-2 px-1 rounded hover:bg-obsidian-light/20 transition-colors text-left">
                        <span className={`text-xs font-medium w-24 flex-shrink-0 ${isOggi ? 'text-red-400' : passato ? 'text-stone/50' : 'text-stone'}`}>
                          {isOggi ? '🔴 Oggi' : formatData(iso)}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {evs.map((e, i) => {
                            const cfg = TIPO_CONFIG[e.tipo]; const Icon = cfg.icon
                            return (
                              <span key={i} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                                <Icon size={9} />{e.titolo.length > 25 ? e.titolo.slice(0, 25) + '…' : e.titolo}
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
          </>)}
        </div>
      )}

      {/* ════════════════════════════════════════════════ AGGIUNGI ═══════ */}
      {tab === 'aggiungi' && (
        <AggiungiPanel isAdmin={isAdmin} userId={userId} profili={profili} loading={loading}
          onSuccess={() => { load(); setTab('lista'); showToast('Elemento aggiunto!') }} />
      )}

      {/* ════════════════════════════════════════════════ EDIT MODAL ═════ */}
      {editTarget && (
        <EditModal
          event={editTarget}
          profili={profili}
          isAdmin={isAdmin}
          userId={userId}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); showToast('Modifiche salvate!') }}
          onQuickComplete={async (e) => {
            await handleQuickComplete(e)
            setEditTarget(null)
          }}
        />
      )}

      {/* FAB — aggiungi rapido */}
      {tab !== 'aggiungi' && (
        <button
          onClick={() => setTab('aggiungi')}
          className="fixed bottom-6 right-5 z-[100] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#C9A84C', color: '#1A1009' }}
          title="Aggiungi elemento"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: AgendaEvent
  userId: string
  isAdmin: boolean
  profili: Profilo[]
  onEdit: (e: AgendaEvent) => void
  onDelete: (e: AgendaEvent) => void
  onStatoChange: (id: string, stato: 'da_fare' | 'in_corso' | 'completato') => void
  onQuickComplete: (e: AgendaEvent) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error') => void
}

function EventRow({ event: e, userId, isAdmin, onEdit, onDelete, onStatoChange, onQuickComplete, onToast }: EventRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cyclingStato, setCyclingStato] = useState(false)
  const [completing, setCompleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const cfg = TIPO_CONFIG[e.tipo]
  const Icon = cfg.icon
  const scad = scadenzaLabel(e.data)
  const isOwn = e.assegnato_a_id === userId || !e.assegnato_a_id

  const canEdit = isAdmin || (e.tipo === 'task' && isOwn)
  const canDelete = isAdmin || (e.tipo === 'task' && isOwn)

  // Click-outside per chiudere il menu
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function cycleStato() {
    if (e.tipo !== 'task' || !e.stato || cyclingStato) return
    const cycle: Record<string, 'da_fare' | 'in_corso' | 'completato'> = {
      da_fare: 'in_corso', in_corso: 'completato', completato: 'da_fare',
    }
    const nuovoStato = cycle[e.stato] as 'da_fare' | 'in_corso' | 'completato' | undefined
    if (!nuovoStato) return
    setCyclingStato(true)
    const r = await fetch(`/api/tasks/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: nuovoStato }),
    })
    if (r.ok) {
      onStatoChange(e.id, nuovoStato)
      onToast(`Stato: ${STATO_LABEL[nuovoStato]}`)
    } else {
      onToast('Errore aggiornamento stato', 'error')
    }
    setCyclingStato(false)
  }

  async function quickComplete(ev: React.MouseEvent) {
    ev.stopPropagation()
    if (completing) return
    setCompleting(true)
    await onQuickComplete(e)
    setCompleting(false)
  }

  const isTaskDone = e.tipo === 'task' && e.stato === 'completato'
  const showFattoBtn = (e.tipo === 'task' && e.stato !== 'completato') || e.tipo === 'adempimento'

  async function doDelete() {
    setDeleting(true)
    const apiPath = e.tipo === 'task' ? 'tasks' : e.tipo === 'ricorrente' ? 'ricorrenti' : 'adempimenti'
    const r = await fetch(`/api/${apiPath}/${e.id}`, { method: 'DELETE' })
    if (r.ok) {
      onDelete(e)
      onToast('Elemento eliminato')
    } else {
      onToast('Errore durante l\'eliminazione', 'error')
    }
    setDeleting(false)
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-obsidian-light/20 transition-colors ${isTaskDone ? 'opacity-50' : ''}`}>
      {/* Bottone Fatto — visibile direttamente */}
      {showFattoBtn ? (
        <button
          onClick={quickComplete}
          disabled={completing}
          title="Segna come fatto"
          className="mt-0.5 flex-shrink-0 w-6 h-6 rounded border border-dashed border-stone/30 flex items-center justify-center text-stone/40 hover:border-green-400/60 hover:text-green-400 hover:bg-green-400/8 transition-all disabled:opacity-30 group"
        >
          {completing
            ? <Loader2 size={11} className="animate-spin" />
            : <Check size={11} className="group-hover:scale-110 transition-transform" />
          }
        </button>
      ) : isTaskDone ? (
        <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded border border-green-500/30 bg-green-500/10 flex items-center justify-center">
          <Check size={11} className="text-green-400" />
        </div>
      ) : (
        <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${cfg.bg}`}>
          <Icon size={12} className={cfg.color} />
        </div>
      )}

      {/* Content — clicca per modificare direttamente */}
      <button
        onClick={() => onEdit(e)}
        className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
        title="Clicca per modificare"
      >
        <div className="flex items-start gap-2 flex-wrap">
          <p className={`text-sm font-medium truncate ${isTaskDone ? 'line-through text-stone' : isOwn ? 'text-cream' : 'text-cream/70'}`}>{e.titolo}</p>
          {isOwn && e.tipo !== 'ricorrente' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80 border border-gold/20 flex-shrink-0">mio</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className={`text-[10px] flex items-center gap-1 ${cfg.color}`}><Icon size={9} />{cfg.label}</span>
          {e.tipo === 'ricorrente' && e.frequenza && (
            <span className="text-[10px] text-stone flex items-center gap-1"><RefreshCw size={9} />{FREQ_LABEL[e.frequenza] ?? e.frequenza}</span>
          )}
          {e.tipo === 'adempimento' && e.categoria && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: CATEGORIA_COLOR[e.categoria as CategoriaAdempimento] ?? '#A0907E' }}>
              <Tag size={9} />{CATEGORIA_LABEL[e.categoria as CategoriaAdempimento] ?? e.categoria}
            </span>
          )}
          {e.tipo === 'task' && e.priorita && (
            <span className={`text-[10px] flex items-center gap-1 ${PRIORITA_COLOR[e.priorita]}`}><AlertTriangle size={9} />{e.priorita}</span>
          )}
          {e.tipo === 'task' && e.stato && (
            <button
              onClick={ev => { ev.preventDefault(); cycleStato() }}
              disabled={cyclingStato}
              title="Tocca per cambiare stato"
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 ${STATO_COLOR[e.stato] ?? 'text-stone border-stone/30'}`}
            >
              {cyclingStato ? '…' : (STATO_LABEL[e.stato] ?? e.stato)}
            </button>
          )}
          {e.assegnato_a_nome && (
            <span className="text-[10px] text-stone flex items-center gap-1"><User size={9} />{e.assegnato_a_nome}</span>
          )}
          {scad.text && (
            <span className={`text-[10px] flex items-center gap-1 ${scad.color}`}><Clock size={9} />{scad.text}</span>
          )}
        </div>
      </button>

      {/* Actions */}
      <div className="flex items-center flex-shrink-0 ml-1">
        {confirmDel ? (
          <div className="flex items-center gap-1 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
            <span className="text-[10px] text-red-400/80 mr-1">Elimina?</span>
            <button onClick={doDelete} disabled={deleting}
              className="text-[10px] font-medium text-red-400 hover:text-red-300 disabled:opacity-50">
              {deleting ? '…' : 'Sì'}
            </button>
            <span className="text-stone/40 text-[10px]">/</span>
            <button onClick={() => setConfirmDel(false)} className="text-[10px] text-stone hover:text-cream">No</button>
          </div>
        ) : (canEdit || canDelete) ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={`p-1.5 rounded transition-colors ${menuOpen ? 'bg-gold/10 text-gold' : 'text-stone/50 hover:text-cream hover:bg-obsidian-light/40'}`}
              title="Azioni"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-[100] min-w-[130px] rounded-lg border shadow-2xl overflow-hidden"
                style={{ backgroundColor: '#1A1009', borderColor: 'rgba(74,59,44,0.7)' }}
              >
                {canEdit && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(e) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-stone hover:text-gold hover:bg-gold/8 transition-colors text-left"
                  >
                    <Pencil size={11} /> Modifica
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDel(true) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-stone hover:text-red-400 hover:bg-red-400/8 transition-colors text-left"
                  >
                    <Trash2 size={11} /> Elimina
                  </button>
                )}
                <a
                  href={e.href}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-stone/50 hover:text-stone hover:bg-obsidian-light/20 transition-colors border-t border-obsidian-light/30"
                >
                  <ExternalLink size={11} /> Vai alla sezione
                </a>
              </div>
            )}
          </div>
        ) : (
          <ChevronRight size={13} className="text-stone/30" />
        )}
      </div>
    </div>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({
  event: e, profili, isAdmin, userId, onClose, onSaved, onQuickComplete,
}: {
  event: AgendaEvent; profili: Profilo[]; isAdmin: boolean; userId: string
  onClose: () => void; onSaved: () => void
  onQuickComplete?: (e: AgendaEvent) => Promise<void>
}) {
  const [titolo, setTitolo] = useState(e.titolo)
  const [descrizione, setDescrizione] = useState(e.descrizione ?? '')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  // Task
  const [priorita, setPriorita] = useState<'bassa' | 'media' | 'alta'>(e.priorita ?? 'media')
  const [scadenza, setScadenza] = useState(e.data ?? '')
  const [assegnatoA, setAssegnatoA] = useState(e.assegnato_a_id ?? '')
  const [stato, setStato] = useState<'da_fare' | 'in_corso' | 'completato'>(e.stato ?? 'da_fare')

  // Ricorrente
  const [frequenzaRic, setFrequenzaRic] = useState(e.frequenza ?? 'settimanale')
  const [assegnatoARic, setAssegnatoARic] = useState(e.assegnato_a_id ?? '')
  const [attiva, setAttiva] = useState(e.attiva !== false)

  // Adempimento
  const [categoria, setCategoria] = useState<CategoriaAdempimento>((e.categoria as CategoriaAdempimento) ?? 'altro')
  const [frequenzaAd, setFrequenzaAd] = useState(e.frequenza ?? 'annuale')
  const [prossima, setProssima] = useState(e.data ?? '')
  const [preavviso, setPreavviso] = useState(e.preavviso_giorni ?? 30)
  const [respMode, setRespMode] = useState<'profilo' | 'etichetta'>(e.responsabile_etichetta ? 'etichetta' : 'profilo')
  const [respProfiloId, setRespProfiloId] = useState(e.assegnato_a_id ?? '')
  const [respEtichetta, setRespEtichetta] = useState(e.responsabile_etichetta ?? '')

  const cfg = TIPO_CONFIG[e.tipo]

  // Nome utente corrente (per commenti)
  const currentProfilo = profili.find(p => p.id === userId)
  const userNome = currentProfilo ? `${currentProfilo.nome} ${currentProfilo.cognome}`.trim() : 'Utente'

  // Escape key
  useEffect(() => {
    function handleKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const [completando, setCompletando] = useState(false)
  const canFatto = (e.tipo === 'task' && e.stato !== 'completato') || e.tipo === 'adempimento'
  const isTaskDone = e.tipo === 'task' && e.stato === 'completato'

  async function handleFatto() {
    if (!onQuickComplete || completando) return
    setCompletando(true)
    await onQuickComplete(e)
    setCompletando(false)
  }

  async function handleSave() {
    if (!titolo.trim()) { setErrore('Il titolo è obbligatorio'); return }
    setSaving(true); setErrore(null)

    let url: string; let body: Record<string, unknown>

    if (e.tipo === 'task') {
      url = `/api/tasks/${e.id}`
      body = {
        titolo: titolo.trim(), descrizione: descrizione.trim() || null,
        priorita, scadenza: scadenza || null, stato,
        ...(isAdmin && assegnatoA ? { assegnato_a: assegnatoA } : {}),
      }
    } else if (e.tipo === 'ricorrente') {
      url = `/api/ricorrenti/${e.id}`
      body = {
        titolo: titolo.trim(), descrizione: descrizione.trim() || null,
        frequenza: frequenzaRic, attiva,
        assegnato_a: assegnatoARic || null,
      }
    } else {
      url = `/api/adempimenti/${e.id}`
      body = {
        titolo: titolo.trim(), descrizione: descrizione.trim() || null,
        categoria, frequenza: frequenzaAd,
        prossima_scadenza: prossima || null,
        preavviso_giorni: preavviso,
        responsabile_profilo_id: respMode === 'profilo' ? (respProfiloId || null) : null,
        responsabile_etichetta: respMode === 'etichetta' ? (respEtichetta.trim() || null) : null,
      }
    }

    const r = await fetch(url, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (r.ok) { onSaved() } else {
      const d = await r.json().catch(() => ({}))
      setErrore(d.error ?? 'Errore nel salvataggio'); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-lg mx-0 sm:mx-4 rounded-t-xl sm:rounded-xl border border-obsidian-light/50 overflow-y-auto max-h-[90vh] shadow-2xl"
        style={{ backgroundColor: '#1A1009', color: '#F2EDE4', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-obsidian-light/30">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone/60">Modifica {cfg.label}</p>
            <h3 className="text-sm font-medium text-cream mt-0.5 truncate max-w-xs">{e.titolo}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/5 text-stone/50 hover:text-cream transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Titolo */}
          <div>
            <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Titolo *</label>
            <input className="input w-full" value={titolo} onChange={ev => setTitolo(ev.target.value)} />
          </div>
          {/* Descrizione */}
          <div>
            <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Descrizione</label>
            <textarea className="input w-full resize-none" rows={2} value={descrizione} onChange={ev => setDescrizione(ev.target.value)} />
          </div>

          {/* ── Task fields ── */}
          {e.tipo === 'task' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Stato</label>
                  <select className="input w-full" value={stato} onChange={ev => setStato(ev.target.value as typeof stato)}>
                    <option value="da_fare">Da fare</option>
                    <option value="in_corso">In corso</option>
                    <option value="completato">Completato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Priorità</label>
                  <select className="input w-full" value={priorita} onChange={ev => setPriorita(ev.target.value as typeof priorita)}>
                    <option value="bassa">Bassa</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Scadenza</label>
                <input type="date" className="input w-full" value={scadenza} onChange={ev => setScadenza(ev.target.value)} />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Assegnato a</label>
                  <select className="input w-full" value={assegnatoA} onChange={ev => setAssegnatoA(ev.target.value)}>
                    <option value="">— Nessuno —</option>
                    {profili.map(p => (
                      <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Commenti task ── */}
              <TaskCommenti
                taskId={e.id}
                userId={userId}
                userNome={userNome}
                isAdmin={isAdmin}
              />
            </>
          )}

          {/* ── Ricorrente fields ── */}
          {e.tipo === 'ricorrente' && (
            <>
              <div>
                <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Frequenza</label>
                <select className="input w-full" value={frequenzaRic} onChange={ev => setFrequenzaRic(ev.target.value)}>
                  <option value="giornaliero">Ogni giorno</option>
                  <option value="settimanale">Ogni settimana</option>
                  <option value="mensile">Ogni mese</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Assegnato a</label>
                <select className="input w-full" value={assegnatoARic} onChange={ev => setAssegnatoARic(ev.target.value)}>
                  <option value="">Tutti (nessuno in specifico)</option>
                  {profili.map(p => (
                    <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={attiva} onChange={ev => setAttiva(ev.target.checked)} className="w-4 h-4 accent-gold" />
                <span className="text-sm text-cream/80">Ricorrente attiva</span>
              </label>
            </>
          )}

          {/* ── Adempimento fields ── */}
          {e.tipo === 'adempimento' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Categoria</label>
                  <select className="input w-full" value={categoria} onChange={ev => setCategoria(ev.target.value as CategoriaAdempimento)}>
                    {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Frequenza</label>
                  <select className="input w-full" value={frequenzaAd} onChange={ev => setFrequenzaAd(ev.target.value)}>
                    {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Prossima scadenza</label>
                  <input type="date" className="input w-full" value={prossima} onChange={ev => setProssima(ev.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Preavviso (giorni)</label>
                  <input type="number" min={1} max={365} className="input w-full" value={preavviso} onChange={ev => setPreavviso(Number(ev.target.value))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone/70 uppercase tracking-wider mb-2">Responsabile</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setRespMode('profilo')}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === 'profilo' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}>
                    Persona interna
                  </button>
                  <button type="button" onClick={() => setRespMode('etichetta')}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === 'etichetta' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}>
                    Etichetta libera
                  </button>
                </div>
                {respMode === 'profilo' ? (
                  <select className="input w-full" value={respProfiloId} onChange={ev => setRespProfiloId(ev.target.value)}>
                    <option value="">— Nessuno —</option>
                    {profili.map(p => (
                      <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>
                    ))}
                  </select>
                ) : (
                  <input className="input w-full" placeholder="Es. Consulente esterno, Studio commercialista…"
                    value={respEtichetta} onChange={ev => setRespEtichetta(ev.target.value)} />
                )}
              </div>
            </>
          )}

          {errore && (
            <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={13} /> {errore}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-5 pb-5 flex-wrap">
          {/* Bottone Fatto — visibile su mobile, utile ovunque */}
          {canFatto && onQuickComplete && (
            <button onClick={handleFatto} disabled={completando}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
              {completando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {completando ? 'Completamento…' : e.tipo === 'adempimento' ? 'Segna come completato' : 'Segna come fatto'}
            </button>
          )}
          {isTaskDone && (
            <span className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border border-green-500/20 text-green-400/60">
              <Check size={13} /> Già completato
            </span>
          )}
          <button onClick={onClose} className="btn-secondary text-xs px-4">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AggiungiPanel ────────────────────────────────────────────────────────────

interface AggiungiPanelProps {
  isAdmin: boolean; userId: string; profili: Profilo[]
  loading: boolean; onSuccess: () => void
}

function AggiungiPanel({ isAdmin, userId, profili, loading: parentLoading, onSuccess }: AggiungiPanelProps) {
  const [tipo, setTipo] = useState<TipoNuovo>('task')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState(false)

  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [priorita, setPriorita] = useState<'bassa' | 'media' | 'alta'>('media')
  const [scadenza, setScadenza] = useState('')
  const [assegnaMode, setAssegnaMode] = useState<'io' | 'altro'>('io')
  const [filtroRuolo, setFiltroRuolo] = useState('')
  const [assegnatoA, setAssegnatoA] = useState('')
  const [frequenzaRic, setFrequenzaRic] = useState<'giornaliero' | 'settimanale' | 'mensile'>('settimanale')
  const [assegnaTutti, setAssegnaTutti] = useState(false)
  const [categoriaAd, setCategoriaAd] = useState<CategoriaAdempimento>('altro')
  const [frequenzaAd, setFrequenzaAd] = useState('annuale')
  const [scadenzaAd, setScadenzaAd] = useState('')
  const [preavvisoGiorni, setPreavvisoGiorni] = useState(30)
  const [respMode, setRespMode] = useState<'profilo' | 'etichetta'>('profilo')
  const [respProfiloId, setRespProfiloId] = useState('')
  const [respEtichetta, setRespEtichetta] = useState('')

  const ruoliDisponibili = useMemo(() => Array.from(new Set(profili.map(p => p.ruolo))).sort(), [profili])
  const profiliFiltrati = useMemo(() => filtroRuolo ? profili.filter(p => p.ruolo === filtroRuolo) : profili, [profili, filtroRuolo])

  function resetForm() {
    setTitolo(''); setDescrizione(''); setPriorita('media'); setScadenza('')
    setAssegnaMode('io'); setFiltroRuolo(''); setAssegnatoA('')
    setFrequenzaRic('settimanale'); setAssegnaTutti(false)
    setCategoriaAd('altro'); setFrequenzaAd('annuale'); setScadenzaAd('')
    setPreavvisoGiorni(30); setRespMode('profilo'); setRespProfiloId(''); setRespEtichetta('')
    setErrore(null); setSuccesso(false)
  }

  function changeTipo(t: TipoNuovo) { setTipo(t); resetForm() }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!titolo.trim()) { setErrore('Il titolo è obbligatorio'); return }
    setSaving(true); setErrore(null); setSuccesso(false)
    try {
      let url = ''; let body: Record<string, unknown> = {}
      if (tipo === 'task') {
        url = '/api/tasks'
        body = { titolo: titolo.trim(), descrizione: descrizione.trim() || undefined, priorita, scadenza: scadenza || undefined, assegnato_a: assegnaMode === 'io' ? userId : (assegnatoA || userId) }
      } else if (tipo === 'ricorrente') {
        url = '/api/ricorrenti'
        body = { titolo: titolo.trim(), descrizione: descrizione.trim() || undefined, frequenza: frequenzaRic, assegnato_a: assegnaTutti ? null : (assegnaMode === 'io' ? userId : (assegnatoA || null)) }
      } else {
        url = '/api/adempimenti'
        body = { titolo: titolo.trim(), descrizione: descrizione.trim() || undefined, categoria: categoriaAd, frequenza: frequenzaAd, prossima_scadenza: scadenzaAd || null, preavviso_giorni: preavvisoGiorni, responsabile_profilo_id: respMode === 'profilo' ? (respProfiloId || null) : null, responsabile_etichetta: respMode === 'etichetta' ? (respEtichetta.trim() || null) : null }
      }
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) { setErrore(data.error ?? 'Errore durante il salvataggio') }
      else { setSuccesso(true); setTimeout(onSuccess, 600) }
    } catch { setErrore('Errore di rete') }
    finally { setSaving(false) }
  }

  function AssigneeSelector({ showTutti = false }: { showTutti?: boolean }) {
    return (
      <div className="space-y-3">
        <label className="block text-xs text-stone uppercase tracking-wider">Assegna a</label>
        {showTutti && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={assegnaTutti} onChange={ev => { setAssegnaTutti(ev.target.checked); setAssegnaMode('io') }} className="w-4 h-4 accent-gold" />
            <span className="text-sm text-cream">Tutti (nessuno in specifico)</span>
          </label>
        )}
        {(!showTutti || !assegnaTutti) && (
          <>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setAssegnaMode('io'); setAssegnatoA('') }}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${assegnaMode === 'io' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}>
                  <User size={10} className="inline mr-1" />A me
                </button>
                <button type="button" onClick={() => setAssegnaMode('altro')}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${assegnaMode === 'altro' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}>
                  <Users size={10} className="inline mr-1" />Altra persona
                </button>
              </div>
            )}
            {(assegnaMode === 'altro' || !isAdmin) && (
              <div className="flex gap-2">
                {isAdmin && (
                  <select className="input text-xs py-1.5 px-2 w-36" value={filtroRuolo} onChange={ev => { setFiltroRuolo(ev.target.value); setAssegnatoA('') }}>
                    <option value="">Tutti i ruoli</option>
                    {ruoliDisponibili.map(r => <option key={r} value={r}>{RUOLO_LABEL[r] ?? r}</option>)}
                  </select>
                )}
                <select className="input text-xs py-1.5 px-2 flex-1" value={assegnatoA} onChange={ev => setAssegnatoA(ev.target.value)}>
                  <option value="">— Scegli persona —</option>
                  {profiliFiltrati.map(p => <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (parentLoading && profili.length === 0) {
    return <div className="flex items-center justify-center gap-2 py-12 text-stone text-sm"><Loader2 size={16} className="animate-spin" />Caricamento…</div>
  }

  return (
    <div className="max-w-lg">
      <div className="card mb-6">
        <p className="text-xs uppercase tracking-wider text-stone/60 mb-3">Tipo di elemento</p>
        <div className="grid grid-cols-3 gap-2">
          {(['task', 'ricorrente', 'adempimento'] as const).map(t => {
            const cfg = TIPO_CONFIG[t]; const Icon = cfg.icon
            const canCreate = t === 'task' ? true : isAdmin
            return (
              <button key={t} type="button" disabled={!canCreate} onClick={() => changeTipo(t)}
                className={`flex flex-col items-center gap-2 p-3 rounded border transition-colors ${tipo === t ? `${cfg.bg} ${cfg.color}` : canCreate ? 'border-obsidian-light text-stone hover:border-stone hover:text-cream' : 'border-obsidian-light/40 text-stone/30 cursor-not-allowed'}`}>
                <Icon size={18} /><span className="text-xs font-medium">{cfg.label}</span>
              </button>
            )
          })}
        </div>
        {(tipo === 'adempimento' || tipo === 'ricorrente') && !isAdmin && (
          <p className="text-[10px] text-stone/60 mt-2">Solo admin e manager possono creare {tipo === 'adempimento' ? 'adempimenti' : 'azioni ricorrenti'}.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Titolo <span className="text-red-400">*</span></label>
          <input className="input w-full" value={titolo} onChange={ev => setTitolo(ev.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Descrizione</label>
          <textarea className="input w-full resize-none" rows={2} value={descrizione} onChange={ev => setDescrizione(ev.target.value)} />
        </div>

        {tipo === 'task' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Priorità</label>
                <select className="input w-full" value={priorita} onChange={ev => setPriorita(ev.target.value as typeof priorita)}>
                  <option value="bassa">Bassa</option><option value="media">Media</option><option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Scadenza</label>
                <input type="date" className="input w-full" value={scadenza} onChange={ev => setScadenza(ev.target.value)} />
              </div>
            </div>
            <AssigneeSelector />
          </>
        )}

        {tipo === 'ricorrente' && (
          <>
            <div>
              <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Frequenza <span className="text-red-400">*</span></label>
              <select className="input w-full" value={frequenzaRic} onChange={ev => setFrequenzaRic(ev.target.value as typeof frequenzaRic)}>
                <option value="giornaliero">Ogni giorno</option><option value="settimanale">Ogni settimana</option><option value="mensile">Ogni mese</option>
              </select>
            </div>
            <AssigneeSelector showTutti />
          </>
        )}

        {tipo === 'adempimento' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Categoria <span className="text-red-400">*</span></label>
                <select className="input w-full" value={categoriaAd} onChange={ev => setCategoriaAd(ev.target.value as CategoriaAdempimento)}>
                  {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Frequenza <span className="text-red-400">*</span></label>
                <select className="input w-full" value={frequenzaAd} onChange={ev => setFrequenzaAd(ev.target.value)}>
                  {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Prossima scadenza</label>
                <input type="date" className="input w-full" value={scadenzaAd} onChange={ev => setScadenzaAd(ev.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Preavviso (giorni)</label>
                <input type="number" min={1} max={365} className="input w-full" value={preavvisoGiorni} onChange={ev => setPreavvisoGiorni(Number(ev.target.value))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-stone uppercase tracking-wider mb-2">Responsabile</label>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setRespMode('profilo')} className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === 'profilo' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}>Persona interna</button>
                <button type="button" onClick={() => setRespMode('etichetta')} className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === 'etichetta' ? 'bg-gold/10 border-gold/30 text-gold' : 'border-obsidian-light text-stone hover:text-cream'}`}>Etichetta libera</button>
              </div>
              {respMode === 'profilo' ? (
                <div className="flex gap-2">
                  <select className="input text-xs py-1.5 px-2 w-36" value={filtroRuolo} onChange={ev => { setFiltroRuolo(ev.target.value); setRespProfiloId('') }}>
                    <option value="">Tutti i ruoli</option>
                    {ruoliDisponibili.map(r => <option key={r} value={r}>{RUOLO_LABEL[r] ?? r}</option>)}
                  </select>
                  <select className="input text-xs py-1.5 px-2 flex-1" value={respProfiloId} onChange={ev => setRespProfiloId(ev.target.value)}>
                    <option value="">— Nessuno —</option>
                    {profiliFiltrati.map(p => <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>)}
                  </select>
                </div>
              ) : (
                <input className="input w-full" placeholder="Es. Consulente esterno…" value={respEtichetta} onChange={ev => setRespEtichetta(ev.target.value)} />
              )}
            </div>
          </>
        )}

        {errore && <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{errore}</div>}
        {successo && <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-3 py-2">✓ Salvato con successo!</div>}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving || successo} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" />Salvataggio…</>
            : successo ? <><CheckSquare size={14} />Salvato!</>
            : <><Plus size={14} />Aggiungi {tipo === 'task' ? 'task' : tipo === 'ricorrente' ? 'ricorrente' : 'adempimento'}</>}
          </button>
          <button type="button" onClick={resetForm} className="text-sm text-stone hover:text-cream transition-colors">Reset</button>
        </div>
      </form>
    </div>
  )
}
