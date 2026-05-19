'use client'

import { useState, useTransition } from 'react'
import { SlidersHorizontal, Building2, Phone, Mail, LayoutDashboard, MessageSquare, Loader2, Check, AlertCircle, Package } from 'lucide-react'
import type { SettingArea } from '@/lib/settings'

// ── Tipi ─────────────────────────────────────────────────────────────────────

interface AllSettings {
  dashboard: {
    giorni_stantio:            number
    giorni_adempimenti_alert:  number
    giorni_manutenzione_alert: number
    max_items_preview:         number
  }
  crm: {
    giorni_followup_default: number
  }
  studio: {
    nome:     string
    email:    string
    telefono: string
  }
  magazzino: {
    giorni_dormiente: number
  }
}

interface Props {
  initialSettings: AllSettings
  isReadOnly: boolean   // segretaria/aso vedono ma non modificano
}

// ── Helper salvataggio singola chiave ─────────────────────────────────────────

async function saveSetting(area: SettingArea, key: string, value: unknown): Promise<string | null> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ area, key, value }),
  })
  if (res.ok) return null
  const json = await res.json().catch(() => ({}))
  return (json as { error?: string }).error ?? 'Errore salvataggio'
}

// ── Sezione wrapper ───────────────────────────────────────────────────────────

function Sezione({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-gold/70" />
        <h3 className="text-xs font-medium text-obsidian/70 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ── Campo numero (giorni/items) ────────────────────────────────────────────────

function CampoNumero({
  label, note, value, onChange, min, max, readOnly,
}: {
  label: string; note: string
  value: number; onChange: (v: number) => void
  min: number; max: number
  readOnly: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-stone/10 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-obsidian/80">{label}</p>
        <p className="text-[11px] text-stone/50 mt-0.5">{note}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!readOnly && (
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-7 h-7 rounded border border-stone/25 text-stone hover:border-gold/40 hover:text-gold transition-colors text-sm font-light"
          >−</button>
        )}
        <span className={`w-10 text-center text-sm font-medium tabular-nums ${readOnly ? 'text-stone/50' : 'text-obsidian'}`}>
          {value}
        </span>
        {!readOnly && (
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            className="w-7 h-7 rounded border border-stone/25 text-stone hover:border-gold/40 hover:text-gold transition-colors text-sm font-light"
          >+</button>
        )}
      </div>
    </div>
  )
}

// ── Campo testo ───────────────────────────────────────────────────────────────

function CampoTesto({
  label, placeholder, value, onChange, type = 'text', readOnly,
}: {
  label: string; placeholder: string
  value: string; onChange: (v: string) => void
  type?: 'text' | 'email' | 'tel'
  readOnly: boolean
}) {
  return (
    <div className="py-2.5 border-b border-stone/10 last:border-0">
      <label className="label-field block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={readOnly ? '—' : placeholder}
        readOnly={readOnly}
        className={`input w-full text-sm ${readOnly ? 'opacity-50 cursor-default' : ''}`}
      />
    </div>
  )
}

// ── Feedback salvataggio ──────────────────────────────────────────────────────

function FeedbackSalva({ stato }: { stato: 'idle' | 'saving' | 'ok' | 'error'; errore?: string }) {
  if (stato === 'idle') return null
  if (stato === 'saving') return (
    <span className="flex items-center gap-1 text-[11px] text-stone/60">
      <Loader2 size={10} className="animate-spin" /> Salvataggio…
    </span>
  )
  if (stato === 'ok') return (
    <span className="flex items-center gap-1 text-[11px] text-green-700">
      <Check size={10} /> Salvato
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[11px] text-red-700">
      <AlertCircle size={10} /> Errore
    </span>
  )
}

// ── Componente principale ─────────────────────────────────────────────────────

export default function SettingsOperativi({ initialSettings, isReadOnly }: Props) {
  const [dashboard, setDashboard] = useState(initialSettings.dashboard)
  const [crm, setCrm]             = useState(initialSettings.crm)
  const [studio, setStudio]       = useState(initialSettings.studio)
  const [magazzino, setMagazzino] = useState(initialSettings.magazzino)

  const [statoDash,    setStatoDash]      = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [statoCrm,     setStatoCrm]       = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [statoStudio,  setStatoStudio]    = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [statoMag,     setStatoMag]       = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')

  const [, startTransition] = useTransition()

  // ── Salvataggio per sezione ─────────────────────────────────────────────
  async function salvaDashboard() {
    setStatoDash('saving')
    const entries: [string, unknown][] = [
      ['giorni_stantio',            dashboard.giorni_stantio],
      ['giorni_adempimenti_alert',  dashboard.giorni_adempimenti_alert],
      ['giorni_manutenzione_alert', dashboard.giorni_manutenzione_alert],
      ['max_items_preview',         dashboard.max_items_preview],
    ]
    const errors = await Promise.all(entries.map(([k, v]) => saveSetting('dashboard', k, v)))
    setStatoDash(errors.some(Boolean) ? 'error' : 'ok')
    setTimeout(() => setStatoDash('idle'), 3000)
  }

  async function salvaCrm() {
    setStatoCrm('saving')
    const err = await saveSetting('crm', 'giorni_followup_default', crm.giorni_followup_default)
    setStatoCrm(err ? 'error' : 'ok')
    setTimeout(() => setStatoCrm('idle'), 3000)
  }

  async function salvaMagazzino() {
    setStatoMag('saving')
    const err = await saveSetting('magazzino', 'giorni_dormiente', magazzino.giorni_dormiente)
    setStatoMag(err ? 'error' : 'ok')
    setTimeout(() => setStatoMag('idle'), 3000)
  }

  async function salvaStudio() {
    setStatoStudio('saving')
    const entries: [string, unknown][] = [
      ['nome',     studio.nome],
      ['email',    studio.email],
      ['telefono', studio.telefono],
    ]
    const errors = await Promise.all(entries.map(([k, v]) => saveSetting('studio', k, v)))
    setStatoStudio(errors.some(Boolean) ? 'error' : 'ok')
    setTimeout(() => setStatoStudio('idle'), 3000)
  }

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="text-[11px] text-amber-700 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
          Visualizzazione in sola lettura — solo admin e manager possono modificare i settings.
        </div>
      )}

      {/* ── Dashboard & Alerting ── */}
      <Sezione icon={LayoutDashboard} title="Dashboard & Alerting">
        <CampoNumero
          label="Ordini stantii dopo" note="Giorni dopo cui un ordine 'inviato' diventa urgente nei widget"
          value={dashboard.giorni_stantio} onChange={v => setDashboard(d => ({ ...d, giorni_stantio: v }))}
          min={1} max={90} readOnly={isReadOnly}
        />
        <CampoNumero
          label="Adempimenti urgenti entro" note="Finestra in giorni per gli adempimenti in scadenza"
          value={dashboard.giorni_adempimenti_alert} onChange={v => setDashboard(d => ({ ...d, giorni_adempimenti_alert: v }))}
          min={1} max={90} readOnly={isReadOnly}
        />
        <CampoNumero
          label="Manutenzioni attrezzature entro" note="Anticipo in giorni per gli alert manutenzioni"
          value={dashboard.giorni_manutenzione_alert} onChange={v => setDashboard(d => ({ ...d, giorni_manutenzione_alert: v }))}
          min={7} max={180} readOnly={isReadOnly}
        />
        <CampoNumero
          label="Preview items per sezione" note="Max elementi mostrati nei widget e nello snapshot Lina"
          value={dashboard.max_items_preview} onChange={v => setDashboard(d => ({ ...d, max_items_preview: v }))}
          min={3} max={20} readOnly={isReadOnly}
        />
        {!isReadOnly && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone/10">
            <FeedbackSalva stato={statoDash} />
            <button
              onClick={() => startTransition(salvaDashboard)}
              disabled={statoDash === 'saving'}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Salva Dashboard
            </button>
          </div>
        )}
      </Sezione>

      {/* ── CRM ── */}
      <Sezione icon={MessageSquare} title="CRM">
        <CampoNumero
          label="Giorni default follow-up" note="Giorni aggiunti alla data odierna quando si apre una nuova interazione"
          value={crm.giorni_followup_default} onChange={v => setCrm(c => ({ ...c, giorni_followup_default: v }))}
          min={0} max={90} readOnly={isReadOnly}
        />
        {!isReadOnly && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone/10">
            <FeedbackSalva stato={statoCrm} />
            <button
              onClick={() => startTransition(salvaCrm)}
              disabled={statoCrm === 'saving'}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Salva CRM
            </button>
          </div>
        )}
      </Sezione>

      {/* ── Studio ── */}
      <Sezione icon={Building2} title="Dati Studio">
        <CampoTesto
          label="Nome studio" placeholder="es. Studio Dentistico Rossi"
          value={studio.nome} onChange={v => setStudio(s => ({ ...s, nome: v }))}
          readOnly={isReadOnly}
        />
        <CampoTesto
          label="Email" placeholder="es. info@studio.it"
          value={studio.email} onChange={v => setStudio(s => ({ ...s, email: v }))}
          type="email" readOnly={isReadOnly}
        />
        <CampoTesto
          label="Telefono" placeholder="es. 081 123 4567"
          value={studio.telefono} onChange={v => setStudio(s => ({ ...s, telefono: v }))}
          type="tel" readOnly={isReadOnly}
        />
        {!isReadOnly && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone/10">
            <FeedbackSalva stato={statoStudio} />
            <div className="flex items-center gap-2">
              <Phone size={10} className="text-stone/40" />
              <Mail size={10} className="text-stone/40" />
              <button
                onClick={() => startTransition(salvaStudio)}
                disabled={statoStudio === 'saving'}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
              >
                Salva Studio
              </button>
            </div>
          </div>
        )}
      </Sezione>

      {/* ── Magazzino ── */}
      <Sezione icon={Package} title="Magazzino">
        <CampoNumero
          label="Prodotti dormienti dopo" note="Giorni senza movimenti di quantità dopo cui un prodotto è considerato dormiente"
          value={magazzino.giorni_dormiente} onChange={v => setMagazzino(m => ({ ...m, giorni_dormiente: v }))}
          min={30} max={730} readOnly={isReadOnly}
        />
        {!isReadOnly && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone/10">
            <FeedbackSalva stato={statoMag} />
            <button
              onClick={() => startTransition(salvaMagazzino)}
              disabled={statoMag === 'saving'}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Salva Magazzino
            </button>
          </div>
        )}
      </Sezione>

      {/* Footer nota */}
      <p className="text-[10px] text-stone/35 text-center flex items-center justify-center gap-1.5">
        <SlidersHorizontal size={9} />
        Settings Operativi v1 — i valori hanno effetto immediato su dashboard, Lina e CRM
      </p>
    </div>
  )
}
