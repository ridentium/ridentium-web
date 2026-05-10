'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AgendaEvent } from '@/types/agenda'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import {
  AlertTriangle, List, CalendarDays, ChevronLeft, ChevronRight,
  Users, User, Check, Search, Plus, Loader2, X,
} from 'lucide-react'
import {
  TIPO_CONFIG, MESI_IT, GIORNI_IT,
  toISO, diffDays, formatData,
  type Profilo, type Tab, type TipoNuovo,
} from './agendaConstants'
import { EventRow } from './EventRow'
import { EditModal } from './EditModal'
import { AggiungiPanel } from './AggiungiPanel'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props { isAdmin: boolean; userId: string }

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgendaView({ isAdmin, userId }: Props) {
  const [tab, setTab] = useState<Tab>('calendario')
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [profili, setProfili] = useState<Profilo[]>([])
  const [loading, setLoading] = useState(true)

  // Lista
  const [mostraTutti, setMostraTutti] = useState(isAdmin)
  const [tipoFilter, setTipoFilter] = useState<'task' | 'ricorrente' | 'adempimento' | 'tutti'>('tutti')
  const [search, setSearch] = useState('')
  const [soloAperti, setSoloAperti] = useState(false)
  const [filterPersona, setFilterPersona] = useState<string>('')

  // FAB
  const [fabOpen, setFabOpen] = useState(false)
  const [fabTipo, setFabTipo] = useState<TipoNuovo>('task')
  const [previousTab, setPreviousTab] = useState<Tab>('calendario')

  // Calendario
  const now = new Date()
  const oggiStr = toISO(now.getFullYear(), now.getMonth(), now.getDate())

  // Stato calendario — valori di default sicuri per SSR (nessuna lettura di window)
  const [calView, setCalView] = useState<'giorno' | 'settimana' | 'mese'>('settimana')
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [viewDay, setViewDay] = useState<string>(oggiStr)

  // Legge ?view= e ?data= dall'URL solo lato client (evita hydration mismatch)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const v = p.get('view')
    const d = p.get('data')
    if (v === 'giorno' || v === 'settimana' || v === 'mese') setCalView(v)
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const parsed = new Date(d + 'T00:00:00')
      setViewDay(d)
      setCalYear(parsed.getFullYear())
      setCalMonth(parsed.getMonth())
    }
  }, [])

  // Navigazione giorno
  function prevDay() {
    const d = new Date(viewDay + 'T00:00:00'); d.setDate(d.getDate() - 1)
    setViewDay(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  function nextDay() {
    const d = new Date(viewDay + 'T00:00:00'); d.setDate(d.getDate() + 1)
    setViewDay(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  function goToToday() { setViewDay(oggiStr) }
  function goToDay(iso: string) { setViewDay(iso); setCalView('giorno') }

  // Navigazione settimana
  function getMondayISO(d: Date): string {
    const day = new Date(d)
    const dow = day.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    day.setDate(day.getDate() + offset)
    return toISO(day.getFullYear(), day.getMonth(), day.getDate())
  }
  const [weekStart, setWeekStart] = useState<string>(() => getMondayISO(now))

  function prevWeek() {
    const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() - 7)
    setWeekStart(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  function nextWeek() {
    const d = new Date(weekStart + 'T00:00:00'); d.setDate(d.getDate() + 7)
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

  // Sincronizza URL con vista corrente
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (tab !== 'calendario') return
    const url = new URL(window.location.href)
    url.searchParams.set('view', calView)
    url.searchParams.set('data', viewDay)
    window.history.replaceState(null, '', url.toString())
  }, [tab, calView, viewDay])

  // Computed maps
  const weekEventMap = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>()
    for (const d of weekDays) m.set(d, [])
    for (const e of events) { if (e.data && m.has(e.data)) m.get(e.data)!.push(e) }
    return m
  }, [events, weekDays])

  const dayViewEvents = useMemo(() => events.filter(e => e.data === viewDay), [events, viewDay])
  const dayViewRicorrenti = useMemo(() => events.filter(e => e.tipo === 'ricorrente'), [events])

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

  // Edit
  const [editTarget, setEditTarget] = useState<AgendaEvent | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  // Quick add
  const [quickAdd, setQuickAdd] = useState<{ date: string } | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickPriorita, setQuickPriorita] = useState<'alta' | 'media' | 'bassa'>('media')
  const [quickAssegnato, setQuickAssegnato] = useState<string>(userId)
  const [quickSaving, setQuickSaving] = useState(false)

  function openQuickAdd(date: string) {
    setQuickAdd({ date }); setQuickTitle(''); setQuickPriorita('media'); setQuickAssegnato(userId)
  }
  function closeQuickAdd() { setQuickAdd(null); setQuickTitle('') }

  async function handleQuickAdd() {
    if (!quickTitle.trim() || !quickAdd || quickSaving) return
    setQuickSaving(true)
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titolo: quickTitle.trim(), priorita: quickPriorita, scadenza: quickAdd.date, assegnato_a: quickAssegnato }),
      })
      if (r.ok) {
        const { task: newTask } = await r.json()
        if (newTask) {
          setEvents(prev => [...prev, { id: newTask.id, tipo: 'task', titolo: newTask.titolo, data: newTask.scadenza, stato: 'da_fare', priorita: quickPriorita } as AgendaEvent])
          showToast(`Task "${newTask.titolo}" aggiunto`)
        }
      } else { showToast('Errore durante l\'aggiunta del task', 'error') }
    } catch { showToast('Errore di rete', 'error') }
    closeQuickAdd(); setQuickSaving(false)
  }

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  // Data
  const supabase = useMemo(() => createBrowserClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/agenda?giorni=180&tutti=${mostraTutti}`, { cache: 'no-store' })
      if (r.ok) { const d = await r.json(); setEvents(d.events ?? []); setProfili(d.profili ?? []) }
    } finally { setLoading(false) }
  }, [mostraTutti])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ricorrenti' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adempimenti' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  // Handlers
  function handleDelete(event: AgendaEvent) { setEvents(prev => prev.filter(e => e.id !== event.id)) }

  function handleStatoChange(id: string, nuovoStato: 'da_fare' | 'in_corso' | 'completato') {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, stato: nuovoStato } : e))
  }

  async function handleQuickComplete(event: AgendaEvent) {
    if (event.tipo === 'task') {
      if (event.stato === 'completato') return
      const prevStato = event.stato ?? 'da_fare'
      handleStatoChange(event.id, 'completato')
      setCompletedIds(prev => new Set(prev).add(event.id))
      const r = await fetch(`/api/tasks/${event.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: 'completato' }),
      })
      if (r.ok) { showToast(`"${event.titolo}" segnato come fatto`) }
      else {
        handleStatoChange(event.id, prevStato as 'da_fare' | 'in_corso' | 'completato')
        setCompletedIds(prev => { const n = new Set(prev); n.delete(event.id); return n })
        showToast('Errore aggiornamento', 'error')
      }
    } else if (event.tipo === 'adempimento') {
      setCompletedIds(prev => new Set(prev).add(event.id))
      const r = await fetch(`/api/adempimenti/${event.id}/completa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      if (r.ok) { showToast(`"${event.titolo}" completato — scadenza rinnovata`) }
      else {
        setCompletedIds(prev => { const n = new Set(prev); n.delete(event.id); return n })
        showToast('Errore completamento adempimento', 'error')
      }
    }
  }

  // Focus: oggi + in ritardo
  const focusItems = useMemo(() => {
    return events.filter(e => {
      if (completedIds.has(e.id)) return false
      if (e.tipo === 'task' && e.stato === 'completato') return false
      if (e.tipo === 'ricorrente' && e.completata_oggi) return false
      if (e.tipo === 'ricorrente') return true
      const days = diffDays(e.data)
      return days !== null && days <= 0
    }).sort((a, b) => (diffDays(a.data) ?? 999) - (diffDays(b.data) ?? 999))
  }, [events, completedIds])

  // Lista filtrata
  const filtered = useMemo(() => {
    let list = events.filter(e => tipoFilter === 'tutti' || e.tipo === tipoFilter)
    if (soloAperti) list = list.filter(e => (e.tipo !== 'task' || e.stato !== 'completato') && !completedIds.has(e.id))
    if (filterPersona) list = list.filter(e => e.assegnato_a_id === filterPersona)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e => e.titolo.toLowerCase().includes(q) || (e.descrizione ?? '').toLowerCase().includes(q))
    }
    return list
  }, [events, tipoFilter, soloAperti, search, filterPersona, completedIds])

  const conData = useMemo(() => filtered.filter(e => e.data !== null), [filtered])
  const senzaData = useMemo(() => filtered.filter(e => e.data === null), [filtered])
  const gruppi = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>()
    for (const e of conData) { if (!m.has(e.data!)) m.set(e.data!, []); m.get(e.data!)!.push(e) }
    return m
  }, [conData])

  // Shared row props
  const rowProps = {
    userId, isAdmin, profili, completedIds,
    onEdit: setEditTarget,
    onDelete: handleDelete,
    onStatoChange: handleStatoChange,
    onQuickComplete: handleQuickComplete,
    onToast: showToast,
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Tab nav */}
      <div className="flex items-center border-b border-obsidian-light">
        {([
          { id: 'focus',      label: 'Focus',      Icon: AlertTriangle },
          { id: 'lista',      label: 'Lista',      Icon: List },
          { id: 'calendario', label: 'Calendario', Icon: CalendarDays },
        ] as const).map(({ id, label, Icon }) => {
          const isFocus = id === 'focus'
          const badge = isFocus ? focusItems.length : 0
          return (
            <button key={id} onClick={() => setTab(id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === id ? 'border-gold text-gold' : 'border-transparent text-stone hover:text-obsidian'}`}>
              <Icon size={13} />{label}
              {badge > 0 && (
                <span className="ml-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                  style={{ background: '#F87171', color: '#FFF' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && tab !== 'aggiungi' && (
        <div className="flex items-center justify-center gap-2 py-12 text-stone text-sm">
          <Loader2 size={16} className="animate-spin" />Caricamento agenda…
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ LISTA ══════ */}
      {tab === 'lista' && !loading && (
        <div className="space-y-5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone/40 pointer-events-none" />
            <input className="input w-full pl-8 pr-8 text-sm" placeholder="Cerca nell'agenda…"
              value={search} onChange={ev => setSearch(ev.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone/40 hover:text-obsidian transition-colors">
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
                        : 'border-obsidian-light text-stone hover:border-stone hover:text-obsidian'}`}>
                    {Icon && <Icon size={11} />}
                    {t === 'tutti' ? 'Tutti' : cfg!.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button onClick={() => setSoloAperti(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  soloAperti ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'border-obsidian-light text-stone hover:border-stone hover:text-obsidian'}`}>
                <Check size={11} />Da completare
              </button>
              {isAdmin && profili.length > 0 && (
                <select value={filterPersona} onChange={e => setFilterPersona(e.target.value)}
                  className="input text-xs py-1.5 pr-7 border-obsidian-light text-stone">
                  <option value="">Tutto il team</option>
                  {profili.map(p => <option key={p.id} value={p.id}>{p.nome} {p.cognome}</option>)}
                </select>
              )}
              {isAdmin && (
                <button onClick={() => setMostraTutti(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                    mostraTutti ? 'bg-stone/10 border-stone/30 text-obsidian' : 'border-obsidian-light text-stone hover:border-stone hover:text-obsidian'}`}>
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

      {/* ═══════════════════════════════════════════════════ FOCUS ══════ */}
      {tab === 'focus' && !loading && (
        <div className="space-y-5">
          {focusItems.length === 0 ? (
            <div className="card text-center py-14">
              <Check size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-green-400">Tutto in ordine</p>
              <p className="text-xs text-stone mt-1">Nessun elemento in ritardo o da completare oggi</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest text-stone/50 px-1">
                {focusItems.length} element{focusItems.length === 1 ? 'o' : 'i'} da gestire
              </p>
              <div className="card p-0 divide-y divide-obsidian-light/30">
                {focusItems.map(e => <EventRow key={e.id} event={e} {...rowProps} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ CALENDARIO ═══ */}
      {tab === 'calendario' && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg overflow-hidden border border-obsidian-light/50">
              {([
                { id: 'giorno',    label: 'Giorno' },
                { id: 'settimana', label: 'Settimana' },
                { id: 'mese',      label: 'Mese' },
              ] as const).map(({ id, label }) => (
                <button key={id} onClick={() => setCalView(id)}
                  className={`text-xs px-3 py-1.5 transition-colors ${calView === id ? 'bg-gold/20 text-gold' : 'text-stone hover:text-obsidian'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Vista giorno ── */}
          {calView === 'giorno' && (() => {
            const vd = new Date(viewDay + 'T00:00:00')
            const isOggiView = viewDay === oggiStr
            const label = vd.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button onClick={prevDay} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-obsidian transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-center">
                    <h2 className={`text-sm font-medium ${isOggiView ? 'text-red-400' : 'text-obsidian'}`}>
                      {isOggiView ? '🔴 ' : ''}{label.charAt(0).toUpperCase() + label.slice(1)}
                    </h2>
                    {!isOggiView && (
                      <button onClick={goToToday} className="text-[10px] text-gold/60 hover:text-gold transition-colors mt-0.5">
                        → Vai a oggi
                      </button>
                    )}
                  </div>
                  <button onClick={nextDay} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-obsidian transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>

                {(dayViewEvents.length > 0 || dayViewRicorrenti.length > 0) && (
                  <p className="text-[10px] text-stone/50 uppercase tracking-widest">
                    {dayViewEvents.length} event{dayViewEvents.length === 1 ? 'o' : 'i'}
                    {dayViewRicorrenti.length > 0 && ` · ${dayViewRicorrenti.length} ricorrent${dayViewRicorrenti.length === 1 ? 'e' : 'i'}`}
                  </p>
                )}

                {/* Quick add */}
                {quickAdd?.date === viewDay ? (
                  <div className="card border-gold/20 bg-gold/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <input autoFocus type="text" placeholder="Titolo task…" value={quickTitle}
                        onChange={e => setQuickTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') closeQuickAdd() }}
                        className="input flex-1 text-sm py-1.5" />
                      <button onClick={handleQuickAdd} disabled={!quickTitle.trim() || quickSaving}
                        className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50 flex-shrink-0">
                        {quickSaving ? '…' : 'Aggiungi'}
                      </button>
                      <button onClick={closeQuickAdd} className="p-1.5 text-stone hover:text-obsidian transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={quickPriorita} onChange={e => setQuickPriorita(e.target.value as typeof quickPriorita)}
                        className="input text-xs py-1 pr-6">
                        <option value="bassa">🟢 Bassa</option>
                        <option value="media">🟡 Media</option>
                        <option value="alta">🔴 Alta</option>
                      </select>
                      {isAdmin && profili.length > 0 && (
                        <select value={quickAssegnato} onChange={e => setQuickAssegnato(e.target.value)} className="input text-xs py-1 pr-6">
                          {profili.map(p => <option key={p.id} value={p.id}>{p.nome} {p.cognome}</option>)}
                        </select>
                      )}
                    </div>
                    <p className="text-[10px] text-stone/40">Invio per salvare · Esc per annullare</p>
                  </div>
                ) : (
                  <button onClick={() => openQuickAdd(viewDay)}
                    className="flex items-center gap-1.5 text-xs text-stone/40 hover:text-stone transition-colors py-1">
                    <Plus size={12} /> Aggiungi task rapido
                  </button>
                )}

                {dayViewEvents.length === 0 && dayViewRicorrenti.length === 0 && (
                  <div className="card text-center py-14">
                    <CalendarDays size={28} className="text-stone/30 mx-auto mb-3" />
                    <p className="text-sm text-stone">Nessun evento per questo giorno</p>
                    <button onClick={() => { setPreviousTab(tab); setTab('aggiungi') }} className="mt-4 btn-primary text-xs">
                      + Aggiungi evento completo
                    </button>
                  </div>
                )}

                {dayViewEvents.length > 0 && (
                  <div className="card p-0 divide-y divide-obsidian-light/30">
                    {dayViewEvents.map(e => <EventRow key={e.id} event={e} {...rowProps} />)}
                  </div>
                )}

                {dayViewRicorrenti.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-stone/50 mb-2">Azioni ricorrenti</p>
                    <div className="card p-0 divide-y divide-obsidian-light/30">
                      {dayViewRicorrenti.map(e => <EventRow key={e.id} event={e} {...rowProps} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Vista settimana ── */}
          {calView === 'settimana' && (() => {
            const weekEndDate = new Date(weekDays[6] + 'T00:00:00')
            const weekStartDate = new Date(weekDays[0] + 'T00:00:00')
            const isCurrentWeek = weekDays.includes(oggiStr)
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={prevWeek} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-obsidian transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-center">
                    <h2 className="text-sm font-medium text-obsidian">
                      {weekStartDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} –{' '}
                      {weekEndDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </h2>
                    {!isCurrentWeek && (
                      <button onClick={goToCurrentWeek} className="text-[10px] text-gold/60 hover:text-gold transition-colors mt-0.5">
                        → Vai a questa settimana
                      </button>
                    )}
                  </div>
                  <button onClick={nextWeek} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-obsidian transition-colors">
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
                        isOggi ? 'border-red-400/30 bg-red-400/5' : 'border-obsidian-light/30 bg-obsidian-light/5'}`}>
                        <div className="text-center mb-2">
                          <p className={`text-[9px] uppercase tracking-wider ${isOggi ? 'text-red-400' : 'text-stone/50'}`}>
                            {GIORNI_IT[i === 6 ? 6 : i]}
                          </p>
                          <button onClick={() => goToDay(iso)} title="Vai alla vista giornaliera"
                            className={`text-sm font-medium w-7 h-7 rounded-full flex items-center justify-center mx-auto hover:bg-obsidian-light/50 transition-colors ${isOggi ? 'text-red-400 bg-red-400/10' : isPast ? 'text-stone/40' : 'text-obsidian/80'}`}>
                            {d.getDate()}
                          </button>
                        </div>
                        <div className="space-y-1">
                          {dayEvs.slice(0, 4).map(e => {
                            const cfg = TIPO_CONFIG[e.tipo]; const Icon = cfg.icon
                            const isCompleted = e.stato === 'completato' || completedIds.has(e.id) || (e.tipo === 'ricorrente' && e.completata_oggi === true)
                            const canFatto = !isCompleted && (e.tipo === 'task' || e.tipo === 'adempimento')
                            return (
                              <div key={e.id} className={`w-full flex items-center gap-0.5 text-[9px] rounded border transition-colors ${
                                isCompleted ? 'bg-green-500/10 border-green-500/30 text-green-400/80' : `${cfg.bg} ${cfg.color}`}`}>
                                <button onClick={() => setEditTarget(e)}
                                  className="flex-1 flex items-center gap-1 px-1.5 py-1 min-w-0 hover:opacity-80 transition-opacity">
                                  {isCompleted ? <Check size={8} className="flex-shrink-0 text-green-400" /> : <Icon size={8} className="flex-shrink-0" />}
                                  <span className="truncate">{e.titolo}</span>
                                </button>
                                {canFatto && (
                                  <button onClick={async (ev) => { ev.stopPropagation(); await handleQuickComplete(e) }}
                                    title="Segna come fatto"
                                    className="flex-shrink-0 px-1 py-1 hover:bg-green-400/20 rounded-r transition-colors border-l border-current/20">
                                    <Check size={7} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          {dayEvs.length > 4 && (
                            <button
                              onClick={() => goToDay(iso)}
                              className="w-full text-[9px] text-stone/50 hover:text-gold/70 text-center transition-colors py-0.5 rounded hover:bg-gold/5"
                            >
                              +{dayEvs.length - 4} altri
                            </button>
                          )}
                          <button onClick={() => { goToDay(iso); setQuickAdd({ date: iso }) }}
                            className="w-full flex items-center justify-center py-0.5 text-stone/20 hover:text-stone/60 transition-colors rounded"
                            title="Aggiungi task">
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

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
          {calView === 'mese' && (
            <>
              <div className="flex items-center justify-between">
                <button onClick={prevMonth} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-obsidian transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <h2 className="text-base font-medium text-obsidian tracking-wide">{MESI_IT[calMonth]} {calYear}</h2>
                <button onClick={nextMonth} className="p-2 rounded hover:bg-obsidian-light/40 text-stone hover:text-obsidian transition-colors">
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
                    const hasPast = (diffDays(iso) ?? 0) < 0
                    const tipos = Array.from(new Set(dayEvs.map(e => e.tipo)))
                    return (
                      <button key={idx} onClick={() => goToDay(iso)}
                        className={`flex flex-col items-center rounded py-1.5 px-0.5 transition-colors min-h-[52px] ${
                          isOggi ? 'bg-red-400/10 ring-1 ring-red-400/30' : dayEvs.length > 0 ? 'hover:bg-obsidian-light/30' : 'hover:bg-obsidian-light/10'}`}>
                        <span className={`text-xs font-medium ${isOggi ? 'text-red-400' : hasPast ? 'text-stone/50' : 'text-obsidian/80'}`}>{day}</span>
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

              {dayEventMap.size === 0 ? (
                <p className="text-sm text-stone text-center py-4">Nessun evento questo mese.</p>
              ) : (
                <div className="card">
                  <p className="text-xs text-stone/60 mb-3 uppercase tracking-wider">Riepilogo {MESI_IT[calMonth]}</p>
                  <div className="space-y-1">
                    {Array.from(dayEventMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([iso, evs]) => {
                      const isOggi = iso === oggiStr; const passato = (diffDays(iso) ?? 0) < 0
                      return (
                        <button key={iso} onClick={() => goToDay(iso)}
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
                          <ChevronRight size={11} className="text-stone/30 ml-auto flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ AGGIUNGI ════ */}
      {tab === 'aggiungi' && (
        <AggiungiPanel key={fabTipo} isAdmin={isAdmin} userId={userId} profili={profili} loading={loading}
          initialTipo={fabTipo} initialDate={viewDay}
          onSuccess={() => { load(); setTab(previousTab); showToast('Elemento aggiunto!') }} />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          event={editTarget} profili={profili} isAdmin={isAdmin} userId={userId}
          onClose={() => setEditTarget(null)}
          onSaved={(patch) => {
            if (patch && editTarget) {
              setEvents(prev => prev.map(ev => ev.id === editTarget.id ? { ...ev, ...patch } : ev))
            }
            setEditTarget(null); load(); showToast('Modifiche salvate!')
          }}
          onQuickComplete={async (e) => { await handleQuickComplete(e); setEditTarget(null) }}
        />
      )}

      {/* FAB */}
      {tab !== 'aggiungi' && (
        <div className="fixed bottom-6 right-5 z-[100]">
          {fabOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setFabOpen(false)} />
              <div className="absolute bottom-16 right-0 rounded-xl border border-stone/25 shadow-2xl overflow-hidden min-w-[190px]"
                style={{ backgroundColor: '#FDFCFA' }}>
                {([
                  { tipo: 'task' as TipoNuovo,        label: 'Nuovo task',        Icon: TIPO_CONFIG.task.icon },
                  { tipo: 'ricorrente' as TipoNuovo,  label: 'Nuova ricorrente',  Icon: TIPO_CONFIG.ricorrente.icon },
                  { tipo: 'adempimento' as TipoNuovo, label: 'Nuovo adempimento', Icon: TIPO_CONFIG.adempimento.icon },
                ]).filter(item => item.tipo === 'task' || isAdmin).map(({ tipo, label, Icon }) => {
                  const cfg = TIPO_CONFIG[tipo]
                  return (
                    <button key={tipo}
                      onClick={() => { setFabTipo(tipo); setFabOpen(false); setPreviousTab(tab); setTab('aggiungi') }}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-sm ${cfg.color} hover:bg-obsidian-light/30 transition-colors text-left`}>
                      <Icon size={15} />{label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <button onClick={() => setFabOpen(v => !v)}
            className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${fabOpen ? 'rotate-45' : ''}`}
            style={{ backgroundColor: '#665647', color: '#F7F4EF' }}
            title="Aggiungi elemento">
            <Plus size={24} />
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}
