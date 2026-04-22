'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Adempimento, Consulente, CATEGORIA_LABEL, CATEGORIA_COLOR,
  FREQUENZA_LABEL, calcolaStato, scadenzaLabel,
  type StatoAdempimento, type CategoriaAdempimento,
} from '@/types/adempimenti'
import {
  CheckCircle2, Clock, AlertCircle, ChevronDown, Filter, X,
  AlertTriangle, FileText, ShieldCheck, RefreshCw,
} from 'lucide-react'

interface Props {
  canEdit: boolean  // admin o manager
}

type FiltroStato = 'tutti' | 'scaduti' | 'in_scadenza' | 'ok'

const STATO_META: Record<StatoAdempimento, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  scaduto:      { Icon: AlertCircle,   color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Scaduto' },
  in_scadenza:  { Icon: Clock,         color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  label: 'In scadenza' },
  ok:           { Icon: CheckCircle2,  color: '#4ADE80', bg: 'rgba(74,222,128,0.10)',  label: 'OK' },
}

export default function AdempimentiView({ canEdit }: Props) {
  const [adempimenti, setAdempimenti] = useState<Adempimento[]>([])
  const [consulenti, setConsulenti] = useState<Consulente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutti')
  const [filtroCategoria, setFiltroCategoria] = useState<'' | CategoriaAdempimento>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [completaTarget, setCompletaTarget] = useState<Adempimento | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/adempimenti', { cache: 'no-store' })
        if (!alive) return
        if (r.ok) {
          const d = await r.json()
          setAdempimenti(d.adempimenti ?? [])
          setConsulenti(d.consulenti ?? [])
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
    // Ordina: scaduti prima, poi in scadenza, poi ok (ordinati per data)
    return [...list].sort((a, b) => {
      const order: Record<StatoAdempimento, number> = { scaduto: 0, in_scadenza: 1, ok: 2 }
      const d = order[a._stato] - order[b._stato]
      if (d !== 0) return d
      const aT = a.prossima_scadenza ? new Date(a.prossima_scadenza).getTime() : 0
      const bT = b.prossima_scadenza ? new Date(b.prossima_scadenza).getTime() : 0
      return aT - bT
    })
  }, [conStato, filtroStato, filtroCategoria])

  async function onCompletato() {
    // Refetch
    const r = await fetch('/api/adempimenti', { cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      setAdempimenti(d.adempimenti ?? [])
    }
    setCompletaTarget(null)
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
      {/* Tabs stato */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'tutti' as const,       label: 'Tutti',       Icon: Filter,        color: '#D2C6B6' },
          { id: 'scaduti' as const,     label: 'Scaduti',     Icon: AlertCircle,   color: '#F87171' },
          { id: 'in_scadenza' as const, label: 'In scadenza', Icon: Clock,         color: '#FBBF24' },
          { id: 'ok' as const,          label: 'A posto',     Icon: CheckCircle2,  color: '#4ADE80' },
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
              style={{ borderColor: filtroCategoria === c ? undefined : CATEGORIA_COLOR[c] + '40', color: filtroCategoria === c ? undefined : CATEGORIA_COLOR[c] }}
            >
              {CATEGORIA_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'rgba(210,198,182,0.5)' }}>
          <ShieldCheck size={32} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.5)' }} />
          <p className="text-sm">{adempimenti.length === 0 ? 'Nessun adempimento configurato.' : 'Nessun adempimento in questo filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const stato = a._stato
            const meta = STATO_META[stato]
            const StatoIcon = meta.Icon
            const isExpanded = expandedId === a.id
            const catColor = CATEGORIA_COLOR[a.categoria]

            return (
              <div
                key={a.id}
                className="card"
                style={{
                  borderLeft: `3px solid ${meta.color}`,
                  background: stato === 'scaduto' ? 'rgba(248,113,113,0.04)' : undefined,
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
                        <h3 className="text-sm font-medium text-cream leading-snug">{a.titolo}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1"
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

                    {/* Azioni principali */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => setCompletaTarget(a)}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded border transition-colors"
                        style={{
                          background: 'rgba(74,222,128,0.12)',
                          borderColor: 'rgba(74,222,128,0.4)',
                          color: '#4ADE80',
                          minHeight: 36,
                        }}
                      >
                        <CheckCircle2 size={13} /> Segna fatto
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded border border-obsidian-light/40 text-stone hover:text-cream transition-colors"
                      >
                        Dettagli <ChevronDown size={11} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Dettagli espandibili */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-obsidian-light/30 space-y-2">
                        {a.descrizione && (
                          <p className="text-xs text-stone/80 leading-relaxed">{a.descrizione}</p>
                        )}
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
                            Ultima esecuzione: {new Date(a.ultima_esecuzione).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
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
      )}

      {/* Modale completamento */}
      {completaTarget && (
        <CompletaModal
          adempimento={completaTarget}
          onClose={() => setCompletaTarget(null)}
          onDone={onCompletato}
        />
      )}
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
  const [note, setNote] = useState('')
  const [evidenza, setEvidenza] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
              Estremi evidenza <span className="text-stone/40">(es. "F24 n. 12345", "Bolla del 22/04", link Drive)</span>
            </label>
            <input
              value={evidenza}
              onChange={e => setEvidenza(e.target.value)}
              placeholder="Identifica il documento prodotto"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-stone mb-1.5">Note <span className="text-stone/40">(opzionali)</span></label>
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
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary text-xs px-4 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(74,222,128,0.15)',
              borderColor: 'rgba(74,222,128,0.4)',
              color: '#4ADE80',
            }}
          >
            <CheckCircle2 size={13} />
            {saving ? 'Salvataggio…' : 'Conferma fatto'}
          </button>
        </div>
      </div>
    </div>
  )
}
