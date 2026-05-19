'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  CheckSquare, RefreshCw, Loader2, TrendingUp,
  ShieldCheck, Package, ClipboardList, Wrench, Phone, AlertCircle,
  AlertTriangle, Clock,
} from 'lucide-react'
import type { DashboardLiveData } from '@/app/api/dashboard/live/route'

// ─── Gauge percentuale circolare ─────────────────────────────────────────────

function GaugeCircle({ valore, size = 56 }: { valore: number; size?: number }) {
  const r = (size / 2) - 5
  const circ = 2 * Math.PI * r
  const fill = Math.min(100, Math.max(0, valore))
  const offset = circ - (fill / 100) * circ

  const color =
    fill >= 80 ? '#22c55e'   // green
    : fill >= 50 ? '#f59e0b' // amber
    : '#ef4444'              // red

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      {/* Sfondo */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={4} className="text-stone/10" />
      {/* Fill */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* Testo — ruota a destra per compensare il -rotate-90 sul SVG */}
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.22}
        fontWeight="500"
        fill={color}
        className="rotate-90"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
      >
        {fill}%
      </text>
    </svg>
  )
}

// ─── Card KPI con gauge (solo per percentuali) ────────────────────────────────

function KPIGaugeCard({
  href, icon: Icon, title, valore, note,
}: {
  href: string
  icon: React.ElementType
  title: string
  valore: number
  note: string
}) {
  const colore =
    valore >= 80 ? 'text-green-700'
    : valore >= 50 ? 'text-amber-600'
    : 'text-red-700'

  return (
    <Link href={href} className="card hover:border-gold/30 transition-all group block">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-stone/50" />
          <span className="text-[10px] font-medium text-obsidian/60 uppercase tracking-widest">{title}</span>
        </div>
        <span className="text-[10px] text-stone/35 group-hover:text-gold/50 transition-colors">→</span>
      </div>
      <div className="flex items-center gap-4">
        <GaugeCircle valore={valore} size={60} />
        <div>
          <p className={`text-2xl font-light font-serif ${colore}`}>{valore}%</p>
          <p className="text-[11px] text-stone/55 mt-0.5 leading-snug">{note}</p>
        </div>
      </div>
    </Link>
  )
}

// ─── Card KPI contatore ───────────────────────────────────────────────────────

type Urgenza = 'ok' | 'warn' | 'crit'

const URGENZA_STYLES: Record<Urgenza, { count: string; bg: string; border: string }> = {
  ok:   { count: 'text-obsidian/70', bg: '',                 border: 'border-stone/20' },
  warn: { count: 'text-amber-700',   bg: 'bg-amber-500/4',  border: 'border-amber-500/25' },
  crit: { count: 'text-red-700',     bg: 'bg-red-500/4',    border: 'border-red-500/25' },
}

function KPICountCard({
  href, icon: Icon, title, valore, label, urgenza = 'ok',
  subValore, subLabel,
}: {
  href: string
  icon: React.ElementType
  title: string
  valore: number
  label: string
  urgenza?: Urgenza
  subValore?: number
  subLabel?: string
}) {
  const s = URGENZA_STYLES[urgenza]
  return (
    <Link href={href} className={`card hover:border-gold/30 transition-all group block ${s.border} ${s.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={13} className={urgenza !== 'ok' ? s.count : 'text-stone/50'} />
          <span className="text-[10px] font-medium text-obsidian/60 uppercase tracking-widest">{title}</span>
        </div>
        <span className="text-[10px] text-stone/35 group-hover:text-gold/50 transition-colors">→</span>
      </div>
      <p className={`text-3xl font-light font-serif mb-0.5 ${s.count}`}>{valore}</p>
      <p className="text-[10px] text-stone/55 uppercase tracking-wider">{label}</p>
      {subValore !== undefined && subValore > 0 && (
        <p className="text-[10px] text-red-600/80 mt-1">
          + {subValore} {subLabel}
        </p>
      )}
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded bg-stone/15" />
        <div className="h-2.5 w-24 rounded bg-stone/15" />
      </div>
      <div className="h-9 w-14 rounded bg-stone/10 mb-1" />
      <div className="h-2.5 w-20 rounded bg-stone/10" />
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function KPIRealiWidget() {
  const [data, setData]       = useState<DashboardLiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const carica = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/live')
      if (!res.ok) throw new Error('Errore caricamento KPI')
      setData(await res.json() as DashboardLiveData)
    } catch {
      setError('Impossibile caricare i KPI. Riprova.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carica() }, [carica])

  // ─── Urgenza helper ──────────────────────────────────────────────────────
  function urgenza(crit: number, warn: number): Urgenza {
    return crit > 0 ? 'crit' : warn > 0 ? 'warn' : 'ok'
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-gold/70" />
          <h3 className="text-xs font-medium text-obsidian/70 uppercase tracking-widest">
            KPI Operativi
          </h3>
          {data && (
            <span className="text-[9px] text-stone/40 border border-stone/20 rounded px-1.5 py-0.5">
              Calcolati in tempo reale
            </span>
          )}
        </div>
        <button
          onClick={carica}
          disabled={loading}
          title="Aggiorna KPI"
          className="flex items-center gap-1.5 text-[10px] text-stone/50 hover:text-stone
                     transition-colors disabled:opacity-40 px-2 py-1 rounded border border-stone/20 hover:border-stone/35"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Aggiorna
        </button>
      </div>

      {/* Errore */}
      {error && !loading && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-500/5 border border-red-500/20 rounded px-3 py-2 mb-4">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {/* ── Riga 1: KPI percentuali ──────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-[9px] text-stone/40 uppercase tracking-widest mb-2">Performance</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading ? (
            <><Skeleton /><Skeleton /></>
          ) : data ? (
            <>
              <KPIGaugeCard
                href="/admin/tasks"
                icon={CheckSquare}
                title="Task completati"
                valore={data.tasks.percentualeSettimana}
                note={`${data.tasks.completatiSettimana} completati · ${data.tasks.apertiTotale} aperti questa settimana`}
              />
              <KPIGaugeCard
                href="/admin/ricorrenti"
                icon={RefreshCw}
                title="Ricorrenti questo mese"
                valore={data.ricorrenti.percentualeMese}
                note={`${data.ricorrenti.completate} di ${data.ricorrenti.totale} completate nel periodo`}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* ── Riga 2: KPI contatori ────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] text-stone/40 uppercase tracking-widest mb-2">Situazione operativa</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)
          ) : data ? (
            <>
              <KPICountCard
                href="/admin/adempimenti"
                icon={ShieldCheck}
                title="Adempimenti"
                valore={data.adempimenti.scaduti}
                label="scaduti"
                urgenza={urgenza(data.adempimenti.scaduti, data.adempimenti.inScadenza)}
                subValore={data.adempimenti.inScadenza}
                subLabel="entro 7gg"
              />
              <KPICountCard
                href="/admin/magazzino"
                icon={Package}
                title="Magazzino"
                valore={data.magazzino.sottoSoglia}
                label="sotto soglia"
                urgenza={urgenza(data.magazzino.sottoSoglia > 10 ? data.magazzino.sottoSoglia : 0, data.magazzino.sottoSoglia)}
                subValore={data.magazzino.critici > 0 ? data.magazzino.critici : undefined}
                subLabel="critici"
              />
              <KPICountCard
                href="/admin/magazzino"
                icon={AlertTriangle}
                title="Scorte critiche"
                valore={data.magazzino.critici}
                label="priorità critica"
                urgenza={urgenza(data.magazzino.critici, 0)}
              />
              <KPICountCard
                href="/admin/magazzino"
                icon={Clock}
                title="Dormienti"
                valore={data.magazzino.dormienti}
                label="senza movimenti"
                urgenza={urgenza(0, data.magazzino.dormienti)}
              />
              <KPICountCard
                href="/admin/ordini"
                icon={ClipboardList}
                title="Ordini"
                valore={data.ordini.stantii}
                label="stantii (+3gg)"
                urgenza={urgenza(data.ordini.stantii, data.ordini.aperti)}
                subValore={data.ordini.aperti - data.ordini.stantii > 0 ? data.ordini.aperti - data.ordini.stantii : undefined}
                subLabel="in attesa"
              />
              <KPICountCard
                href="/admin/attrezzature"
                icon={Wrench}
                title="Attrezzature"
                valore={data.attrezzature.entro30gg}
                label="manutenzioni 30gg"
                urgenza={urgenza(0, data.attrezzature.entro30gg)}
              />
              <KPICountCard
                href="/admin/crm"
                icon={Phone}
                title="Follow-up CRM"
                valore={data.crmFollowUp.scaduti + data.crmFollowUp.oggi}
                label="da richiamare"
                urgenza={urgenza(data.crmFollowUp.scaduti, data.crmFollowUp.oggi + data.crmFollowUp.settimana)}
                subValore={data.crmFollowUp.settimana > 0 ? data.crmFollowUp.settimana : undefined}
                subLabel="questa settimana"
              />
              <KPICountCard
                href="/admin/tasks"
                icon={CheckSquare}
                title="Task urgenti"
                valore={data.tasks.urgentiAperti}
                label="alta priorità"
                urgenza={urgenza(data.tasks.scadutiAperti, data.tasks.urgentiAperti)}
                subValore={data.tasks.scadutiAperti > 0 ? data.tasks.scadutiAperti : undefined}
                subLabel="scaduti"
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Footer loader */}
      {loading && data && (
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-stone/10">
          <Loader2 size={10} className="animate-spin text-stone/40" />
          <span className="text-[10px] text-stone/40">Aggiornamento…</span>
        </div>
      )}
    </div>
  )
}
