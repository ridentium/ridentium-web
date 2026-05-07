'use client'

import { User, Users } from 'lucide-react'
import { RUOLO_LABEL, type Profilo } from './agendaConstants'

export interface AssigneeSelectorProps {
  isAdmin: boolean
  assegnaMode: 'io' | 'altro'
  setAssegnaMode: (m: 'io' | 'altro') => void
  filtroRuolo: string
  setFiltroRuolo: (r: string) => void
  assegnatoA: string
  setAssegnatoA: (id: string) => void
  ruoliDisponibili: string[]
  profiliFiltrati: Profilo[]
  showTutti?: boolean
  assegnaTutti?: boolean
  setAssegnaTutti?: (v: boolean) => void
}

export function AssigneeSelector({
  isAdmin, assegnaMode, setAssegnaMode,
  filtroRuolo, setFiltroRuolo,
  assegnatoA, setAssegnatoA,
  ruoliDisponibili, profiliFiltrati,
  showTutti = false,
  assegnaTutti = false,
  setAssegnaTutti,
}: AssigneeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-xs text-stone uppercase tracking-wider">Assegna a</label>

      {showTutti && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={assegnaTutti}
            onChange={ev => {
              setAssegnaTutti?.(ev.target.checked)
              setAssegnaMode('io')
            }}
            className="w-4 h-4 accent-gold"
          />
          <span className="text-sm text-cream">Tutti (nessuno in specifico)</span>
        </label>
      )}

      {(!showTutti || !assegnaTutti) && (
        <>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setAssegnaMode('io'); setAssegnatoA('') }}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  assegnaMode === 'io'
                    ? 'bg-gold/10 border-gold/30 text-gold'
                    : 'border-obsidian-light text-stone hover:text-cream'
                }`}
              >
                <User size={10} className="inline mr-1" />A me
              </button>
              <button
                type="button"
                onClick={() => setAssegnaMode('altro')}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  assegnaMode === 'altro'
                    ? 'bg-gold/10 border-gold/30 text-gold'
                    : 'border-obsidian-light text-stone hover:text-cream'
                }`}
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
                  onChange={ev => { setFiltroRuolo(ev.target.value); setAssegnatoA('') }}
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
                onChange={ev => setAssegnatoA(ev.target.value)}
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
