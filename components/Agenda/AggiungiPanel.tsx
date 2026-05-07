'use client'

import { useState, useMemo } from 'react'
import { CATEGORIA_LABEL } from '@/types/adempimenti'
import type { CategoriaAdempimento } from '@/types/adempimenti'
import {
  TIPO_CONFIG, FREQ_LABEL, RUOLO_LABEL,
  type Profilo, type TipoNuovo,
} from './agendaConstants'
import { AssigneeSelector } from './AssigneeSelector'
import { Plus, Loader2, CheckSquare } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AggiungiPanelProps {
  isAdmin: boolean
  userId: string
  profili: Profilo[]
  loading: boolean
  onSuccess: () => void
  initialTipo?: TipoNuovo
  initialDate?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AggiungiPanel({
  isAdmin, userId, profili, loading: parentLoading, onSuccess,
  initialTipo = 'task', initialDate,
}: AggiungiPanelProps) {
  const [tipo, setTipo] = useState<TipoNuovo>(initialTipo)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [successo, setSuccesso] = useState(false)

  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [priorita, setPriorita] = useState<'bassa' | 'media' | 'alta'>('media')
  const [scadenza, setScadenza] = useState(initialDate ?? '')
  const [assegnaMode, setAssegnaMode] = useState<'io' | 'altro'>('io')
  const [filtroRuolo, setFiltroRuolo] = useState('')
  const [assegnatoA, setAssegnatoA] = useState('')
  const [frequenzaRic, setFrequenzaRic] = useState<'giornaliero' | 'settimanale' | 'mensile'>('settimanale')
  const [assegnaTutti, setAssegnaTutti] = useState(false)
  const [categoriaAd, setCategoriaAd] = useState<CategoriaAdempimento>('altro')
  const [frequenzaAd, setFrequenzaAd] = useState('annuale')
  const [scadenzaAd, setScadenzaAd] = useState(initialDate ?? '')
  const [preavvisoGiorni, setPreavvisoGiorni] = useState(30)
  const [respMode, setRespMode] = useState<'profilo' | 'etichetta'>('profilo')
  const [respProfiloId, setRespProfiloId] = useState('')
  const [respEtichetta, setRespEtichetta] = useState('')

  const ruoliDisponibili = useMemo(() => Array.from(new Set(profili.map(p => p.ruolo))).sort(), [profili])
  const profiliFiltrati = useMemo(() => filtroRuolo ? profili.filter(p => p.ruolo === filtroRuolo) : profili, [profili, filtroRuolo])

  function resetForm() {
    setTitolo(''); setDescrizione(''); setPriorita('media'); setScadenza(initialDate ?? '')
    setAssegnaMode('io'); setFiltroRuolo(''); setAssegnatoA('')
    setFrequenzaRic('settimanale'); setAssegnaTutti(false)
    setCategoriaAd('altro'); setFrequenzaAd('annuale'); setScadenzaAd(initialDate ?? '')
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
        body = {
          titolo: titolo.trim(), descrizione: descrizione.trim() || undefined,
          priorita, scadenza: scadenza || undefined,
          assegnato_a: assegnaMode === 'io' ? userId : (assegnatoA || userId),
        }
      } else if (tipo === 'ricorrente') {
        url = '/api/ricorrenti'
        body = {
          titolo: titolo.trim(), descrizione: descrizione.trim() || undefined,
          frequenza: frequenzaRic,
          assegnato_a: assegnaTutti ? null : (assegnaMode === 'io' ? userId : (assegnatoA || null)),
        }
      } else {
        url = '/api/adempimenti'
        body = {
          titolo: titolo.trim(), descrizione: descrizione.trim() || undefined,
          categoria: categoriaAd, frequenza: frequenzaAd,
          prossima_scadenza: scadenzaAd || null, preavviso_giorni: preavvisoGiorni,
          responsabile_profilo_id: respMode === 'profilo' ? (respProfiloId || null) : null,
          responsabile_etichetta: respMode === 'etichetta' ? (respEtichetta.trim() || null) : null,
        }
      }
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) { setErrore(data.error ?? 'Errore durante il salvataggio') }
      else { setSuccesso(true); setTimeout(onSuccess, 600) }
    } catch { setErrore('Errore di rete') }
    finally { setSaving(false) }
  }

  const assigneeSelectorProps = {
    isAdmin,
    assegnaMode, setAssegnaMode,
    filtroRuolo, setFiltroRuolo,
    assegnatoA, setAssegnatoA,
    ruoliDisponibili, profiliFiltrati,
    assegnaTutti, setAssegnaTutti,
  }

  if (parentLoading && profili.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-stone text-sm">
        <Loader2 size={16} className="animate-spin" />Caricamento…
      </div>
    )
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
                className={`flex flex-col items-center gap-2 p-3 rounded border transition-colors ${
                  tipo === t ? `${cfg.bg} ${cfg.color}`
                  : canCreate ? 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  : 'border-obsidian-light/40 text-stone/30 cursor-not-allowed'
                }`}>
                <Icon size={18} /><span className="text-xs font-medium">{cfg.label}</span>
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
            <AssigneeSelector {...assigneeSelectorProps} />
          </>
        )}

        {tipo === 'ricorrente' && (
          <>
            <div>
              <label className="block text-xs text-stone uppercase tracking-wider mb-1.5">Frequenza <span className="text-red-400">*</span></label>
              <select className="input w-full" value={frequenzaRic} onChange={ev => setFrequenzaRic(ev.target.value as typeof frequenzaRic)}>
                <option value="giornaliero">Ogni giorno</option>
                <option value="settimanale">Ogni settimana</option>
                <option value="mensile">Ogni mese</option>
              </select>
            </div>
            <AssigneeSelector {...assigneeSelectorProps} showTutti />
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
                <div className="flex gap-2">
                  <select className="input text-xs py-1.5 px-2 w-36" value={filtroRuolo}
                    onChange={ev => { setFiltroRuolo(ev.target.value); setRespProfiloId('') }}>
                    <option value="">Tutti i ruoli</option>
                    {ruoliDisponibili.map(r => <option key={r} value={r}>{RUOLO_LABEL[r] ?? r}</option>)}
                  </select>
                  <select className="input text-xs py-1.5 px-2 flex-1" value={respProfiloId} onChange={ev => setRespProfiloId(ev.target.value)}>
                    <option value="">— Nessuno —</option>
                    {profiliFiltrati.map(p => <option key={p.id} value={p.id}>{p.cognome} {p.nome} ({RUOLO_LABEL[p.ruolo] ?? p.ruolo})</option>)}
                  </select>
                </div>
              ) : (
                <input className="input w-full" placeholder="Es. Consulente esterno…"
                  value={respEtichetta} onChange={ev => setRespEtichetta(ev.target.value)} />
              )}
            </div>
          </>
        )}

        {errore && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{errore}</div>
        )}
        {successo && (
          <div className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-3 py-2">✓ Salvato con successo!</div>
        )}

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
