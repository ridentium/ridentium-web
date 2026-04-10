'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Ruolo = 'aso' | 'segretaria' | 'manager'
type Sezione = 'magazzino' | 'tasks' | 'ricorrenti' | 'sop'

interface PermessoRow {
  sezione: Sezione
  ruolo: Ruolo
  visibile: boolean
}

const SEZIONI: { key: Sezione; label: string }[] = [
  { key: 'magazzino', label: 'Magazzino' },
  { key: 'tasks', label: 'Task' },
  { key: 'ricorrenti', label: 'Azioni Ricorrenti' },
  { key: 'sop', label: 'Protocolli SOP' },
]

const RUOLI: { key: Ruolo; label: string; color: string }[] = [
  { key: 'aso', label: 'ASO', color: 'text-blue-400' },
  { key: 'segretaria', label: 'Segretaria', color: 'text-purple-400' },
  { key: 'manager', label: 'Manager', color: 'text-green-400' },
]

interface Props {
  permessi: PermessoRow[]
}

export default function PermessiAdmin({ permessi: initialPermessi }: Props) {
  const supabase = createClient()
  const [permessi, setPermessi] = useState<PermessoRow[]>(initialPermessi)
  const [saving, setSaving] = useState<string | null>(null)

  function isVisibile(sezione: Sezione, ruolo: Ruolo): boolean {
    const p = permessi.find(x => x.sezione === sezione && x.ruolo === ruolo)
    return p?.visibile ?? true
  }

  async function toggle(sezione: Sezione, ruolo: Ruolo) {
    var key = sezione + '-' + ruolo
    var current = isVisibile(sezione, ruolo)
    var newVal = !current

    setPermessi(function(prev) {
      return prev.map(function(p) {
        return p.sezione === sezione && p.ruolo === ruolo ? { ...p, visibile: newVal } : p
      })
    })
    setSaving(key)

    var result = await supabase
      .from('sezione_permessi')
      .upsert({ sezione, ruolo, visibile: newVal }, { onConflict: 'sezione,ruolo' })

    setSaving(null)

    if (result.error) {
      setPermessi(function(prev) {
        return prev.map(function(p) {
          return p.sezione === sezione && p.ruolo === ruolo ? { ...p, visibile: current } : p
        })
      })
    }
  }

  return (
    <div className="card border-obsidian-light/60 mt-6">
      <div className="mb-6">
        <p className="text-stone text-xs tracking-widest uppercase mb-1">Permessi Sezioni</p>
        <p className="text-stone/50 text-xs">
          Controlla quali sezioni sono visibili per ogni ruolo. L&apos;admin ha sempre accesso completo.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left pb-4 pr-6">
                <span className="text-stone/40 text-xs uppercase tracking-wider">Sezione</span>
              </th>
              {RUOLI.map(function(r) {
                return (
                  <th key={r.key} className="text-center pb-4 px-4 min-w-[100px]">
                    <span className={`text-xs font-medium uppercase tracking-wider ${r.color}`}>
                      {r.label}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian-light/30">
            {SEZIONI.map(function(s) {
              return (
                <tr key={s.key}>
                  <td className="py-3.5 pr-6">
                    <span className="text-cream text-sm">{s.label}</span>
                  </td>
                  {RUOLI.map(function(r) {
                    var key = s.key + '-' + r.key
                    var vis = isVisibile(s.key, r.key)
                    var isSaving = saving === key
                    return (
                      <td key={r.key} className="py-3.5 px-4 text-center">
                        <button
                          onClick={function() { toggle(s.key, r.key) }}
                          disabled={isSaving}
                          aria-label={`Toggle ${s.label} per ${r.label}`}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                            vis ? 'bg-gold' : 'bg-obsidian-light'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                              vis ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`}
                          />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-obsidian-light/30 flex items-center gap-4 text-xs text-stone/40">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-gold/80" />
          <span>Visibile</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-obsidian-light" />
          <span>Nascosta</span>
        </div>
        <span className="ml-auto">Le modifiche vengono salvate automaticamente</span>
      </div>
    </div>
  )
}
