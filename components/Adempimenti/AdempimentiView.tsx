'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Adempimento, Consulente, CATEGORIA_LABEL, CATEGORIA_COLOR,
  FREQUENZA_LABEL, calcolaStato, scadenzaLabel,
  type StatoAdempimento, type CategoriaAdempimento, type FrequenzaAdempimento,
} from '@/types/adempimenti'
import { DEFAULT_IMPOSTAZIONI, type ImpostazioniStudio } from '@/types/impostazioni'
import Toast, { type ToastState } from '@/components/ui/Toast'
import {
  CheckCircle2, Clock, AlertCircle, ChevronDown, Filter, X,
  AlertTriangle, FileText, ShieldCheck, RefreshCw,
  LayoutList, CalendarDays, AlignLeft, UserCircle2,
  Pencil, Trash2, Check, Loader2, Search,
} from 'lucide-react'
import AdempimentiCalendario from './AdempimentiCalendario'
import AdempimentiTimeline from './AdempimentiTimeline'

interface Props {
  canEdit: boolean
}

type FiltroStato = 'tutti' | 'scaduti' | 'in_scadenza' | 'ok'
type ViewMode = 'lista' | 'calendario' | 'timeline'

const STATO_META: Record<StatoAdempimento, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  scaduto:     { Icon: AlertCircle,  color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Scaduto' },
  in_scadenza: { Icon: Clock,        color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  label: 'In scadenza' },
  ok:          { Icon: CheckCircle2, color: '#4ADE80', bg: 'rgba(74,222,128,0.10)',  label: 'OK' },
}

export default function AdempimentiView({ canEdit }: Props) {
  const [adempimenti, setAdempimenti]     = useState<Adempimento[]>([])
  const [consulenti, setConsulenti]       = useState<Consulente[]>([])
  const [profili, setProfili]             = useState<{ id: string; nome: string; cognome: string; ruolo: string }[]>([])
  const [impostazioni, setImpostazioni]   = useState<ImpostazioniStudio>(DEFAULT_IMPOSTAZIONI)
  const [loading, setLoading]             = useState(true)
  const [filtroStato, setFiltroStato]     = useState<FiltroStato>('tutti')
  const [filtroCategoria, setFiltroCategoria] = useState<'' | CategoriaAdempimento>('')
  const [search, setSearch]               = useState('')
  const [view, setView]                   = useState<ViewMode>('lista')
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [completaTarget, setCompletaTarget] = useState<Adempimento | null>(null)
  const [editTarget, setEditTarget]       = useState<Adempimento | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [segnandoId, setSegnandoId]       = useState<string | null>(null)

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [rAd, rImp] = await Promise.all([
          fetch('/api/adempimenti', { cache: 'no-store' }),
          fetch('/api/impostazioni', { cache: 'no-store' }),
        ])
        if (!alive) return
        if (rAd.ok) {
          const d = await rAd.json()
          setAdempimenti(d.adempimenti ?? [])
          setConsulenti(d.consulenti ?? [])
          setProfili(d.profili ?? [])
        }
        if (rImp.ok) {
          const imp = await rImp.json()
          setImpostazioni({
            giorni_apertura: imp.giorni_apertura ?? DEFAULT_IMPOSTAZIONI.giorni_apertura,
            orario_apertura: imp.orario_apertura ?? DEFAULT_IMPOSTAZIONI.orario_apertura,
            orario_chiusura: imp.orario_chiusura ?? DEFAULT_IMPOSTAZIONI.orario_chiusura,
          })
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const categorie = useMemo(() => {
    const set = new Set<CategoriaAdempimento>()
    adempimenti.forEach(a => set.add(a.categoria))
    return Array.from(set).sort()
  }, [adempimenti])

  const conStato = useMemo(() =>
    adempimenti.map(a => ({ ...a, _stato: calcolaStato(a) })),
  [adempimenti])

  const counts = useMemo(() => ({
    tutti:       conStato.length,
    scaduti:     conStato.filter(a => a._stato === 'scaduto').length,
    in_scadenza: conStato.filter(a => a._stato === 'in_scadenza').length,
    ok:          conStato.filter(a => a._stato === 'ok').length,
  }), [conStato])

  const filtered = useMemo(() => {
    let list = conStato
    if (filtroStato !== 'tutti') list = list.filter(a => a._stato === filtroStato)
    if (filtroCategoria)         list = list.filter(a => a.categoria === filtroCategoria)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.titolo.toLowerCase().includes(q) ||
        (a.descrizione ?? '').toLowerCase().includes(q) ||
        CATEGORIA_LABEL[a.categoria]?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      const order: Record<StatoAdempimento, number> = { scaduto: 0, in_scadenza: 1, ok: 2 }
      const d = order[a._stato] - order[b._stato]
      if (d !== 0) return d
      const aT = a.prossima_scadenza ? new Date(a.prossima_scadenza).getTime() : 0
      const bT = b.prossima_scadenza ? new Date(b.prossima_scadenza).getTime() : 0
      return aT - bT
    })
  }, [conStato, filtroStato, filtroCategoria, search])

  async function onAssegnaResponsabile(adempimentoId: string, profiloId: string | null) {
    await fetch(`/api/adempimenti/${adempimentoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsabile_profilo_id: profiloId }),
    })
    const r = await fetch('/api/adempimenti', { cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      setAdempimenti(d.adempimenti ?? [])
    }
  }

  async function reloadAdempimenti() {
    const r = await fetch('/api/adempimenti', { cache: 'no-store' })
    if (r.ok) { const d = await r.json(); setAdempimenti(d.adempimenti ?? []) }
  }

  async function onCompletato() {
    await reloadAdempimenti()
    setCompletaTarget(null)
    showToast('Adempimento completato!')
  }

  // Smart "Segna fatto": se non serve evidenza, completa direttamente senza modal
  async function segnaDiretto(a: Adempimento) {
    if (a.evidenza_richiesta) {
      setCompletaTarget(a)
      return
    }
    setSegnandoId(a.id)
    const r = await fetch(`/api/adempimenti/${a.id}/completa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: null, evidenza_descrizione: null }),
    })
    if (r.ok) {
      await reloadAdempimenti()
      showToast('Adempimento segnato come fatto!')
    } else {
      showToast('Errore durante il completamento', 'error')
    }
    setSegnandoId(null)
  }

  async function onSalvaModifica(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/adempimenti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (r.ok) {
      await reloadAdempimenti()
      showToast('Modifiche salvate!')
    } else {
      showToast('Errore nel salvataggio', 'error')
    }
    setEditTarget(null)
  }

  async function onElimina(id: string) {
    setDeletingId(id)
    const r = await fetch(`/api/adempimenti/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setAdempimenti(prev => prev.filter(a => a.id !== id))
      showToast('Adempimento eliminato')
    } else {
      showToast('Errore durante l\'eliminazione', 'error')
    }
    setDeletingId(null); setConfirmDeleteId(null)
  }

  function responsabileLabel(a: Adempimento): string {
    if (a.responsabile_profilo) return `${a.responsabile_profilo.nome} ${a.responsabile_profilo.cognome}`
    if (a.consulente) return a.consulente.nome
    return a.responsabile_etichetta ?? '—'
  }

  if (loading) {
    return (
      <div className="card text-center py-12 flex items-center justify-center gap-3" style={{ color: 'rgba(210,198,182,0.6)' }}>
        <RefreshCw size={16} className="animate-spin" /> Caricamento adempimenti…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toggle vista */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 rounded border border-obsidian-light/30" style={{ background: 'rgba(26,16,9,0.6)' }}>
          {([
            { id: 'lista'     as const, label: 'Lista',      Icon: LayoutList  },
            { id: 'calendario' as const, label: 'Calendario', Icon: CalendarDays },
            { id: 'timeline'  as const, label: 'Timeline',   Icon: AlignLeft   },
          ]).map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors"
              style={{
                background: view === v.id ? 'rgba(201,168,76,0.2)' : 'transparent',
                color: view === v.id ? '#C9A84C' : 'rgba(160,144,126,0.7)',
                borderColor: view === v.id ? 'rgba(201,168,76,0.4)' : 'transparent',
                border: view === v.id ? '1px solid rgba(201,168,76,0.4)' : '1px solid transparent',
              }}
            >
              <v.Icon size={12} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Info orario apertura */}
        <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'rgba(160,144,126,0.5)' }}>
          <span>Apertura studio:</span>
          <span style={{ color: 'rgba(210,198,182,0.7)' }}>
            {impostazioni.orario_apertura}–{impostazioni.orario_chiusura}
          </span>
        </div>
      </div>

      {/* Tabs stato */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'tutti'       as const, label: 'Tutti',       Icon: Filter,       color: '#D2C6B6' },
          { id: 'scaduti'     as const, label: 'Scaduti',     Icon: AlertCircle,  color: '#F87171' },
          { id: 'in_scadenza' as const, label: 'In scadenza', Icon: Clock,        color: '#FBBF24' },
          { id: 'ok'          as const, label: 'A posto',     Icon: CheckCircle2, color: '#4ADE80' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setFiltroStato(t.id)}
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded border transition-colors ${
              filtroStato === t.id
                ? 'border-gold/50 bg-gold/15 text-gold'
                : 'border-obsidian-light/40 text-stone hover:text-cream'
            }`}
            style={{ minHeight: 36 }}
          >
            <t.Icon size={12} style={{ color: filtroStato === t.id ? undefined : t.color }} />
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filtroStato === t.id ? 'bg-gold/30' : 'bg-obsidian-light/40'}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Filtro categoria */}
      {categorie.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center pb-3 border-b border-obsidian-light/20">
          <span className="text-[10px] text-stone/50 uppercase tracking-widest mr-1">Categoria</span>
          <button
            onClick={() => setFiltroCategoria('')}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              filtroCategoria === '' ? 'bg-gold/15 border-gold/40 text-gold' : 'border-obsidian-light/30 text-stone/70 hover:text-cream'
            }`}
          >
            Tutte
          </button>
          {categorie.map(c => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(filtroCategoria === c ? '' : c)}
              className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                filtroCategoria === c ? 'bg-gold/15 border-gold/40 text-gold' : 'border-obsidian-light/30 text-stone/70 hover:text-cream'
              }`}
              style={{
                borderColor: filtroCategoria === c ? undefined : CATEGORIA_COLOR[c] + '40',
                color: filtroCategoria === c ? undefined : CATEGORIA_COLOR[c],
              }}
            >
              {CATEGORIA_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      {/* Search bar — solo in vista lista */}
      {view === 'lista' && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone/40 pointer-events-none" />
          <input
            className="input w-full pl-8 pr-8 text-sm"
            placeholder="Cerca negli adempimenti…"
            value={search}
            onChange={e => setSearch(e.target.value)}
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
      )}

      {/* ── Vista Calendario ── */}
      {view === 'calendario' && (
        <AdempimentiCalendario
          adempimenti={filtered}
          giorniApertura={impostazioni.giorni_apertura}
          onSegnaFatto={setCompletaTarget}
        />
      )}

      {/* ── Vista Timeline ── */}
      {view === 'timeline' && (
        <AdempimentiTimeline
          adempimenti={filtered}
          giorniApertura={impostazioni.giorni_apertura}
          onSegnaFatto={setCompletaTarget}
        />
      )}

      {/* ── Vista Lista ── */}
      {view === 'lista' && (
        filtered.length === 0 ? (
          <div className="card text-center py-12" style={{ color: 'rgba(210,198,182,0.5)' }}>
            <ShieldCheck size={32} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.5)' }} />
            <p className="text-sm">
              {search
                ? `Nessun risultato per "${search}".`
                : adempimenti.length === 0
                  ? 'Nessun adempimento configurato.'
                  : 'Nessun adempimento in questo filtro.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => {
              const stato = a._stato
              const meta  = STATO_META[stato]
              const StatoIcon = meta.Icon
              const isExpanded = expandedId === a.id
              const catColor   = CATEGORIA_COLOR[a.categoria]
              const isScaduto  = stato === 'scaduto'

              return (
                <div
                  key={a.id}
                  className="card"
                  style={{
                    borderLeft: `3px solid ${meta.color}`,
                    background: isScaduto ? 'rgba(248,113,113,0.04)' : undefined,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}
                    >
                      <StatoIcon size={16} style={{ color: meta.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium text-cream leading-snug">{a.titolo}</h3>
                            {/* Badge SCADUTO prominente */}
                            {isScaduto && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.4)' }}
                              >
                                ⚠ Scaduto
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded border"
                              style={{ color: catColor, borderColor: catColor + '50', background: catColor + '12' }}
                            >
                              {CATEGORIA_LABEL[a.categoria]}
                            </span>
                            <span className="text-[10px] text-stone/70 border border-obsidian-light/30 px-1.5 py-0.5 rounded">
                              {FREQUENZA_LABEL[a.frequenza]}
                            </span>
                            <span className="text-[10px] text-stone/70">
                              {responsabileLabel(a)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-medium" style={{ color: meta.color }}>
                            {scadenzaLabel(a)}
                          </span>
                          {a.prossima_scadenza && (
                            <span className="text-[10px] text-stone/50">
                              {new Date(a.prossima_scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {/* Smart "Segna fatto" */}
                        <button
                          onClick={() => segnaDiretto(a)}
                          disabled={segnandoId === a.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded border transition-colors disabled:opacity-50"
                          style={{ background: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.4)', color: '#4ADE80', minHeight: 36 }}
                        >
                          {segnandoId === a.id
                            ? <><Loader2 size={13} className="animate-spin" /> Salvataggio…</>
                            : <><CheckCircle2 size={13} /> Segna fatto</>
                          }
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded border border-obsidian-light/40 text-stone hover:text-cream transition-colors"
                        >
                          Dettagli <ChevronDown size={11} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setEditTarget(a)}
                            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border border-obsidian-light/40 text-stone hover:text-gold hover:border-gold/40 transition-colors"
                          >
                            <Pencil size={11} /> Modifica
                          </button>
                        )}
                        {canEdit && confirmDeleteId !== a.id && (
                          <button
                            onClick={() => setConfirmDeleteId(a.id)}
                            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border border-obsidian-light/40 text-stone/60 hover:text-red-400 hover:border-red-400/40 transition-colors"
                          >
                            <Trash2 size={11} /> Elimina
                          </button>
                        )}
                        {confirmDeleteId === a.id && (
                          <div className="flex items-center gap-1 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
                            <span className="text-[10px] text-red-400/80 mr-1">Elimina?</span>
                            <button
                              onClick={() => onElimina(a.id)}
                              disabled={deletingId === a.id}
                              className="text-[10px] font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              {deletingId === a.id ? '…' : 'Sì'}
                            </button>
                            <span className="text-stone/40 text-[10px]">/</span>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-stone hover:text-cream">No</button>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-obsidian-light/30 space-y-2">
                          {a.descrizione && (
                            <p className="text-xs text-stone/80 leading-relaxed">{a.descrizione}</p>
                          )}

                          {/* Assegnato a — editabile da admin/manager */}
                          <div className="flex items-center gap-2 text-xs">
                            <UserCircle2 size={12} className="text-gold/60 flex-shrink-0" />
                            <span className="text-stone/60 flex-shrink-0">Assegnato a:</span>
                            {canEdit ? (
                              <select
                                value={a.responsabile_profilo_id ?? ''}
                                onChange={e => onAssegnaResponsabile(a.id, e.target.value || null)}
                                className="flex-1 min-w-0 text-xs rounded border px-2 py-1 outline-none"
                                style={{
                                  background: 'rgba(26,16,9,0.8)',
                                  borderColor: 'rgba(74,59,44,0.6)',
                                  color: '#D2C6B6',
                                }}
                              >
                                <option value="">— Nessuno / etichetta —</option>
                                {profili.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.nome} {p.cognome}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-cream/80">{responsabileLabel(a)}</span>
                            )}
                            {canEdit && a.responsabile_etichetta && !a.responsabile_profilo_id && (
                              <span className="text-stone/50 truncate">({a.responsabile_etichetta})</span>
                            )}
                          </div>

                          {a.evidenza_richiesta && (
                            <div className="flex items-start gap-2 text-xs">
                              <FileText size={12} className="text-gold/70 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-stone/60">Evidenza richiesta:</span>{' '}
                                <span className="text-cream/80">{a.evidenza_richiesta}</span>
                              </div>
                            </div>
                          )}
                          {a.riferimento_normativo && (
                            <div className="flex items-start gap-2 text-xs">
                              <ShieldCheck size={12} className="text-blue-400/70 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-stone/60">Riferimento:</span>{' '}
                                <span className="text-cream/70 italic">{a.riferimento_normativo}</span>
                              </div>
                            </div>
                          )}
                          {a.ultima_esecuzione && (
                            <div className="text-[11px] text-stone/50 italic">
                              Ultima esecuzione:{' '}
                              {new Date(a.ultima_esecuzione).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Modale completamento */}
      {completaTarget && (
        <CompletaModal adempimento={completaTarget} onClose={() => setCompletaTarget(null)} onDone={onCompletato} />
      )}

      {/* Modale modifica */}
      {editTarget && (
        <EditAdempimentoModal
          adempimento={editTarget}
          profili={profili}
          onClose={() => setEditTarget(null)}
          onSaved={(body) => onSalvaModifica(editTarget.id, body)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* Suppress unused import warning */}
      {consulenti.length === 0 && null}
    </div>
  )
}

// ─── Modale completamento ───────────────────────────────────────────────────

function CompletaModal({
  adempimento, onClose, onDone,
}: {
  adempimento: Adempimento
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote]       = useState('')
  const [evidenza, setEvidenza] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit() {
    if (saving) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/adempimenti/${adempimento.id}/completa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || null, evidenza_descrizione: evidenza || null }),
    })
    if (res.ok) {
      onDone()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Errore nel salvataggio')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-obsidian border border-obsidian-light rounded-t-xl sm:rounded-xl p-5 sm:p-6 w-full sm:max-w-md mx-0 sm:mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gold/70">Segna come fatto</p>
            <h3 className="text-base font-medium text-cream mt-1 leading-snug">{adempimento.titolo}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center rounded transition-colors"
            style={{ color: 'rgba(160,144,126,0.6)', minWidth: 40, minHeight: 40 }}
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {adempimento.evidenza_richiesta && (
          <div className="flex items-start gap-2 mb-4 p-2.5 rounded bg-gold/5 border border-gold/20">
            <FileText size={14} className="text-gold/80 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-cream/80">
              <span className="text-stone/60">Evidenza richiesta:</span>{' '}
              <span className="text-gold/90">{adempimento.evidenza_richiesta}</span>
            </p>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-stone mb-1.5">
              Estremi evidenza{' '}
              <span className="text-stone/40">(es. "F24 n. 12345", "Bolla del 22/04", link Drive)</span>
            </label>
            <input
              value={evidenza}
              onChange={e => setEvidenza(e.target.value)}
              placeholder="Identifica il documento prodotto"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-stone mb-1.5">
              Note <span className="text-stone/40">(opzionali)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="Eventuali osservazioni"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving} className="btn-secondary text-xs px-4 disabled:opacity-50">Annulla</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border transition-colors disabled:opacity-50"
            style={{ background: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.4)', color: '#4ADE80' }}>
            <CheckCircle2 size={13} />{saving ? 'Salvataggio…' : 'Conferma fatto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modale modifica adempimento ─────────────────────────────────────────────

function EditAdempimentoModal({
  adempimento: a, profili, onClose, onSaved,
}: {
  adempimento: Adempimento
  profili: { id: string; nome: string; cognome: string; ruolo: string }[]
  onClose: () => void
  onSaved: (body: Record<string, unknown>) => Promise<void>
}) {
  const [titolo, setTitolo]           = useState(a.titolo)
  const [descrizione, setDescrizione] = useState(a.descrizione ?? '')
  const [categoria, setCategoria]     = useState<CategoriaAdempimento>(a.categoria)
  const [frequenza, setFrequenza]     = useState<FrequenzaAdempimento>(a.frequenza)
  const [prossima, setProssima]       = useState(a.prossima_scadenza ?? '')
  const [preavviso, setPreavviso]     = useState(a.preavviso_giorni)
  const [evidenza, setEvidenza]       = useState(a.evidenza_richiesta ?? '')
  const [riferimento, setRiferimento] = useState(a.riferimento_normativo ?? '')
  const [note, setNote]               = useState(a.note ?? '')
  const [respMode, setRespMode]       = useState<'profilo' | 'etichetta'>(a.responsabile_etichetta && !a.responsabile_profilo_id ? 'etichetta' : 'profilo')
  const [respProfiloId, setRespProfiloId] = useState(a.responsabile_profilo_id ?? '')
  const [respEtichetta, setRespEtichetta] = useState(a.responsabile_etichetta ?? '')
  const [saving, setSaving]           = useState(false)
  const [errore, setErrore]           = useState<string | null>(null)

  const RUOLO_LABEL: Record<string, string> = {
    admin: 'Admin', manager: 'Manager', aso: 'ASO', segretaria: 'Segreteria', clinico: 'Clinico',
  }

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSave() {
    if (!titolo.trim()) { setErrore('Il titolo è obbligatorio'); return }
    setSaving(true); setErrore(null)
    await onSaved({
      titolo: titolo.trim(),
      descrizione: descrizione.trim() || null,
      categoria,
      frequenza,
      prossima_scadenza: prossima || null,
      preavviso_giorni: preavviso,
      evidenza_richiesta: evidenza.trim() || null,
      riferimento_normativo: riferimento.trim() || null,
      note: note.trim() || null,
      responsabile_profilo_id: respMode === 'profilo' ? (respProfiloId || null) : null,
      responsabile_etichetta: respMode === 'etichetta' ? (respEtichetta.trim() || null) : null,
    })
    setSaving(false)
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
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.7)' }}>Modifica adempimento</p>
            <h3 className="text-sm font-medium text-cream mt-0.5 truncate max-w-xs">{a.titolo}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/5 transition-colors" style={{ color: 'rgba(160,144,126,0.6)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Titolo *</label>
            <input className="input w-full" value={titolo} onChange={e => setTitolo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Descrizione</label>
            <textarea className="input w-full resize-none" rows={2} value={descrizione} onChange={e => setDescrizione(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Categoria</label>
              <select className="input w-full" value={categoria} onChange={e => setCategoria(e.target.value as CategoriaAdempimento)}>
                {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Frequenza</label>
              <select className="input w-full" value={frequenza} onChange={e => setFrequenza(e.target.value as FrequenzaAdempimento)}>
                {Object.entries(FREQUENZA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Prossima scadenza</label>
              <input type="date" className="input w-full" value={prossima} onChange={e => setProssima(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Preavviso (giorni)</label>
              <input type="number" min={1} max={365} className="input w-full" value={preavviso} onChange={e => setPreavviso(Number(e.target.value))} />
            </div>
          </div>

          {/* Responsabile */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'rgba(160,144,126,0.8)' }}>Responsabile</label>
            <div className="flex gap-2 mb-2">
              {(['profilo', 'etichetta'] as const).map(m => (
                <button key={m} type="button" onClick={() => setRespMode(m)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${respMode === m ? 'border-gold/40 text-gold' : 'border-obsidian-light/40 text-stone hover:text-cream'}`}
                  style={respMode === m ? { background: 'rgba(201,168,76,0.12)' } : undefined}>
                  {m === 'profilo' ? 'Persona interna' : 'Etichetta libera'}
                </button>
              ))}
            </div>
            {respMode === 'profilo' ? (
              <select className="input w-full" value={respProfiloId} onChange={e => setRespProfiloId(e.target.value)}>
                <option value="">— Nessuno —</option>
                {profili.map(p => <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>)}
              </select>
            ) : (
              <input className="input w-full" placeholder="Es. Consulente esterno…" value={respEtichetta} onChange={e => setRespEtichetta(e.target.value)} />
            )}
          </div>

          {/* Campi opzionali */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Evidenza richiesta</label>
            <input className="input w-full" placeholder="Es. Registro sterilizzazione compilato" value={evidenza} onChange={e => setEvidenza(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Riferimento normativo</label>
            <input className="input w-full" placeholder="Es. D.Lgs 81/2008 art. 18" value={riferimento} onChange={e => setRiferimento(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(160,144,126,0.8)' }}>Note interne</label>
            <textarea className="input w-full resize-none" rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {errore && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
              <AlertTriangle size={13} /> {errore}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-5 pb-5">
          <button onClick={onClose} disabled={saving} className="btn-secondary text-xs px-4 disabled:opacity-50">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border transition-colors disabled:opacity-50"
            style={{ background: 'rgba(201,168,76,0.15)', borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </div>
  )
}
