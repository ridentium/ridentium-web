'use client'

import { useState, useEffect } from 'react'
import type { AgendaEvent } from '@/types/agenda'
import { CATEGORIA_LABEL } from '@/types/adempimenti'
import type { CategoriaAdempimento } from '@/types/adempimenti'
import TaskCommenti from '@/components/Tasks/TaskCommenti'
import {
  TIPO_CONFIG, FREQ_LABEL, RUOLO_LABEL,
  type Profilo,
} from './agendaConstants'
import { X, Check, Loader2, AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  event: AgendaEvent
  profili: Profilo[]
  isAdmin: boolean
  userId: string
  onClose: () => void
  onSaved: (patch?: Partial<AgendaEvent>) => void
  onQuickComplete?: (e: AgendaEvent) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditModal({ event: e, profili, isAdmin, userId, onClose, onSaved, onQuickComplete }: Props) {
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
    if (r.ok) {
      const patch: Partial<AgendaEvent> = { titolo: titolo.trim(), descrizione: descrizione.trim() || null }
      if (e.tipo === 'task') {
        Object.assign(patch, { stato, priorita, data: scadenza || null })
      } else if (e.tipo === 'ricorrente') {
        Object.assign(patch, { frequenza: frequenzaRic, attiva })
      } else {
        Object.assign(patch, { categoria, frequenza: frequenzaAd, data: prossima || null })
      }
      onSaved(patch)
    } else {
      const d = await r.json().catch(() => ({}))
      setErrore(d.error ?? 'Errore nel salvataggio'); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:w-[440px] h-full flex flex-col border-l border-obsidian-light/50 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#1A1009', color: '#F2EDE4' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-obsidian-light/30" style={{ backgroundColor: '#1A1009' }}>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone/60">Modifica {cfg.label}</p>
            <h3 className="text-sm font-medium text-cream mt-0.5 truncate max-w-xs">{e.titolo}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/5 text-stone/50 hover:text-cream transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs text-stone/70 uppercase tracking-wider mb-1.5">Titolo *</label>
              <input className="input w-full" value={titolo} onChange={ev => setTitolo(ev.target.value)} />
            </div>
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
                <TaskCommenti taskId={e.id} userId={userId} userNome={userNome} isAdmin={isAdmin} />
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
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex gap-3 justify-end px-5 py-4 flex-wrap border-t border-obsidian-light/30"
          style={{ backgroundColor: '#1A1009', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
