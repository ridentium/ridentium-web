'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Package, ClipboardList, ShieldCheck, CheckSquare,
  Wrench, Phone, RefreshCw, Loader2, AlertTriangle,
} from 'lucide-react'
import type { DashboardLiveData } from '@/app/api/dashboard/live/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOra(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function formatDataBreve(iso: string): string {
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

function ggLabel(gg: number): string {
  if (gg < 0)  return `scaduto da ${Math.abs(gg)} gg`
  if (gg === 0) return 'scade oggi'
  if (gg === 1) return 'scade domani'
  return `tra ${gg} gg`
}

// ─── Sezione card ─────────────────────────────────────────────────────────────

type AlertLevel = 'ok' | 'warn' | 'crit'

function alertLevel(crit: number, warn: number): AlertLevel {
  if (crit > 0) return 'crit'
  if (warn > 0) return 'warn'
  return 'ok'
}

const LEVEL_STYLES: Record<AlertLevel, { border: string; bg: string; badge: string; text: string }> = {
  ok:   { border: 'border-stone/20',    bg: '',               badge: 'bg-green-500/10 text-green-700 border-green-500/25', text: 'text-green-700' },
  warn: { border: 'border-amber-500/30', bg: 'bg-amber-500/4', badge: 'bg-amber-500/15 text-amber-700 border-amber-500/30', text: 'text-amber-700' },
  crit: { border: 'border-red-500/30',   bg: 'bg-red-500/4',   badge: 'bg-red-500/10 text-red-700 border-red-500/25',      text: 'text-red-700' },
}

interface SectionCardProps {
  href: string
  icon: React.ElementType
  title: string
  level: AlertLevel
  primaryCount: number
  primaryLabel: string
  secondaryCount?: number
  secondaryLabel?: string
  items: { label: string; note?: string; crit?: boolean }[]
  emptyLabel: string
}

function SectionCard({
  href, icon: Icon, title, level,
  primaryCount, primaryLabel,
  secondaryCount, secondaryLabel,
  items, emptyLabel,
}: SectionCardProps) {
  const s = LEVEL_STYLES[level]

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-4 transition-all hover:shadow-sm hover:border-gold/30 ${s.border} ${s.bg}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon size={13} className={level !== 'ok' ? s.text : 'text-stone/60'} />
          <span className="text-[10px] font-medium text-obsidian/70 uppercase tracking-widest">{title}</span>
        </div>
        <span className="text-[10px] text-stone/40">→</span>
      </div>

      {/* Contatori */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${s.badge}`}>
          {primaryCount} {primaryLabel}
        </span>
        {secondaryCount !== undefined && secondaryCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded border bg-red-500/10 text-red-700 border-red-500/25 font-medium">
            {secondaryCount} {secondaryLabel}
          </span>
        )}
      </div>

      {/* Preview items */}
      {items.length === 0 ? (
        <p className="text-[11px] text-stone/40 italic">{emptyLabel}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${
                item.crit ? 'bg-red-500' : level === 'warn' ? 'bg-amber-400' : 'bg-stone/30'
              }`} />
              <div className="min-w-0">
                <p className="text-[11px] text-obsidian/80 truncate leading-tight">{item.label}</p>
                {item.note && (
                  <p className={`text-[9px] mt-0.5 ${item.crit ? 'text-red-600' : 'text-stone/45'}`}>{item.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-stone/15 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded bg-stone/15" />
        <div className="h-2.5 w-20 rounded bg-stone/15" />
      </div>
      <div className="h-5 w-16 rounded-full bg-stone/10 mb-3" />
      <div className="space-y-1.5">
        <div className="h-2.5 w-full rounded bg-stone/10" />
        <div className="h-2.5 w-4/5 rounded bg-stone/10" />
        <div className="h-2.5 w-3/5 rounded bg-stone/10" />
      </div>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function StudioStatusWidget() {
  const [data, setData]       = useState<DashboardLiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/live')
      if (!res.ok) throw new Error('Errore nel caricamento')
      const json = await res.json() as DashboardLiveData
      setData(json)
    } catch {
      setError('Impossibile caricare lo stato studio. Riprova.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  // ── Preparazione dati sezioni ─────────────────────────────────────────────

  const sections: SectionCardProps[] = data
    ? [
        // 1. Magazzino
        {
          href: '/admin/magazzino',
          icon: Package,
          title: 'Magazzino',
          level: alertLevel(data.magazzino.sottoSoglia, 0),
          primaryCount: data.magazzino.sottoSoglia,
          primaryLabel: 'sotto soglia',
          items: data.magazzino.items.map(i => ({
            label: i.prodotto,
            note:  `${i.quantita} / min ${i.soglia_minima} ${i.categoria}`,
            crit:  i.quantita === 0,
          })),
          emptyLabel: 'Tutto in ordine ✓',
        },

        // 2. Ordini
        {
          href: '/admin/ordini',
          icon: ClipboardList,
          title: 'Ordini',
          level: alertLevel(data.ordini.stantii, data.ordini.aperti),
          primaryCount: data.ordini.aperti,
          primaryLabel: 'aperti',
          secondaryCount: data.ordini.stantii,
          secondaryLabel: `stant${data.ordini.stantii === 1 ? 'io' : 'i'} (+3gg)`,
          items: data.ordini.items.map(i => ({
            label: i.fornitore_nome,
            note:  `${i.stato.replace('_', ' ')} · ${i.giorni > 0 ? `${i.giorni} gg fa` : 'oggi'}`,
            crit:  i.giorni > 3 && i.stato === 'inviato',
          })),
          emptyLabel: 'Nessun ordine in attesa ✓',
        },

        // 3. Adempimenti
        {
          href: '/admin/adempimenti',
          icon: ShieldCheck,
          title: 'Adempimenti',
          level: alertLevel(data.adempimenti.scaduti, data.adempimenti.inScadenza),
          primaryCount: data.adempimenti.scaduti,
          primaryLabel: `scadut${data.adempimenti.scaduti === 1 ? 'o' : 'i'}`,
          secondaryCount: data.adempimenti.inScadenza,
          secondaryLabel: 'entro 7 gg',
          items: data.adempimenti.items.map(i => ({
            label: i.titolo,
            note:  ggLabel(i.gg),
            crit:  i.scaduto,
          })),
          emptyLabel: 'Tutto in regola ✓',
        },

        // 4. Task
        {
          href: '/admin/tasks',
          icon: CheckSquare,
          title: 'Task',
          level: alertLevel(data.tasks.scadutiAperti, data.tasks.urgentiAperti),
          primaryCount: data.tasks.urgentiAperti,
          primaryLabel: 'urgent',
          secondaryCount: data.tasks.scadutiAperti,
          secondaryLabel: 'scaduti',
          items: data.tasks.items.map(i => ({
            label: i.titolo,
            note:  i.scaduto
              ? 'scaduto'
              : i.scadenza
              ? `entro ${formatDataBreve(i.scadenza)}`
              : 'priorità alta',
            crit: i.scaduto,
          })),
          emptyLabel: 'Nessun task urgente ✓',
        },

        // 5. Attrezzature
        {
          href: '/admin/attrezzature',
          icon: Wrench,
          title: 'Attrezzature',
          level: alertLevel(
            data.attrezzature.items.filter(i => i.gg <= 0).length,
            data.attrezzature.entro30gg,
          ),
          primaryCount: data.attrezzature.entro30gg,
          primaryLabel: 'manutenzioni entro 30gg',
          items: data.attrezzature.items.map(i => ({
            label: i.nome,
            note:  ggLabel(-i.gg),
            crit:  i.gg <= 0,
          })),
          emptyLabel: 'Nessuna manutenzione imminente ✓',
        },

        // 6. CRM Follow-up
        {
          href: '/admin/crm',
          icon: Phone,
          title: 'Follow-up CRM',
          level: alertLevel(data.crmFollowUp.scaduti, data.crmFollowUp.oggi + data.crmFollowUp.settimana),
          primaryCount: data.crmFollowUp.scaduti + data.crmFollowUp.oggi,
          primaryLabel: 'da richiamare',
          secondaryCount: data.crmFollowUp.scaduti,
          secondaryLabel: 'scaduti',
          items: data.crmFollowUp.items.map(i => ({
            label: [i.nome, i.cognome].filter(Boolean).join(' ') || '—',
            note:  formatDataBreve(i.prossima_data),
            crit:  i.prossima_data < new Date().toISOString().slice(0, 10),
          })),
          emptyLabel: 'Nessun follow-up pendente ✓',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-gold/70" />
          <h3 className="text-xs font-medium text-obsidian/70 uppercase tracking-widest">
            Stato Studio
          </h3>
          {data && (
            <span className="text-[9px] text-stone/40 border border-stone/20 rounded px-1.5 py-0.5">
              agg. {formatOra(data.ts)}
            </span>
          )}
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] text-stone/50 hover:text-stone
                     transition-colors disabled:opacity-40 px-2 py-1 rounded border border-stone/20 hover:border-stone/35"
          title="Aggiorna"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Aggiorna
        </button>
      </div>

      {/* Error */}
      {error && !loading && (
        <p className="text-xs text-red-700 bg-red-500/5 border border-red-500/20 rounded px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {/* Griglia 3x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : sections.map((s, i) => <SectionCard key={i} {...s} />)
        }
      </div>

      {/* Footer — loader indicator */}
      {loading && data && (
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-stone/10">
          <Loader2 size={10} className="animate-spin text-stone/40" />
          <span className="text-[10px] text-stone/40">Aggiornamento in corso…</span>
        </div>
      )}
    </div>
  )
}
