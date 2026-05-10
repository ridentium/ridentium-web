'use client'

import { useState, useTransition } from 'react'
import { Ricorrente, UserProfile } from '@/types'
import { Plus, Trash2, Power, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getPeriodoKey } from '@/lib/periodo'

const FREQ_LABEL: Record<string, string> = {
  giornaliero:  'Giornaliero',
  settimanale:  'Settimanale',
  mensile:      'Mensile',
  trimestrale:  'Trimestrale',
  semestrale:   'Semestrale',
  annuale:      'Annuale',
  biennale:     'Biennale',
  triennale:    'Triennale',
  quinquennale: 'Quinquennale',
}

interface Props {
  ricorrenti: Ricorrente[]
  staff: UserProfile[]
  currentUserId: string
  currentUserNome: string
}

export default function RicorrentiAdmin({ ricorrenti, staff, currentUserId, currentUserNome }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [newTitolo, setNewTitolo] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFreq, setNewFreq] = useState<Ricorrente['frequenza']>('giornaliero')
  const [newAssignee, setNewAssignee] = useState<string>('null')
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Toggle completamento via API atomica (RPC Postgres FOR UPDATE)
  async function toggleCompletamento(az: Ricorrente) {
    if (toggling === az.id) return
    setToggling(az.id)
    try {
      const res = await fetch(`/api/ricorrenti/${az.id}/completamento`, { method: 'POST' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Errore sconosciuto' }))
        console.error('[toggleCompletamento]', error)
      }
      startTransition(() => router.refresh())
    } finally {
      setToggling(null)
    }
  }

  // Attiva/disattiva tramite PATCH /api/ricorrenti/[id]
  async function toggleAttiva(az: Ricorrente) {
    await fetch(`/api/ricorrenti/${az.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attiva: !az.attiva }),
    })
    startTransition(() => router.refresh())
  }

  // Elimina (soft delete) tramite DELETE /api/ricorrenti/[id]
  async function deleteAzione(az: Ricorrente) {
    if (!confirm(`Eliminare "${az.titolo}"?`)) return
    await fetch(`/api/ricorrenti/${az.id}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  // Crea nuova azione tramite POST /api/ricorrenti
  async function addAzione() {
    if (saving) return
    if (!newTitolo.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/ricorrenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo:      newTitolo.trim(),
          descrizione: newDesc.trim() || null,
          frequenza:   newFreq,
          assegnato_a: newAssignee === 'null' ? null : newAssignee,
        }),
      })
      if (res.ok) {
        setNewTitolo(''); setNewDesc(''); setNewFreq('giornaliero'); setNewAssignee('null')
        setShowForm(false)
        startTransition(() => router.refresh())
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Errore sconosciuto' }))
        console.error('[addAzione]', error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-stone">
          <RefreshCw size={12} />
          <span>{ricorrenti.filter(a => a.attiva).length} azioni attive</span>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Nuova azione
        </button>
      </div>

      {/* Form nuova azione */}
      {showForm && (
        <div className="card space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Nuova azione ricorrente</h3>
          <input className="input" placeholder="Titolo" value={newTitolo} onChange={e => setNewTitolo(e.target.value)} />
          <input className="input" placeholder="Descrizione (opzionale)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div className="flex gap-3">
            <select className="input" value={newFreq} onChange={e => setNewFreq(e.target.value as Ricorrente['frequenza'])}>
              {Object.entries(FREQ_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select className="input" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
              <option value="null">Tutti lo staff</option>
              {staff.map(u => <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={addAzione} disabled={saving || !newTitolo.trim()} className="btn-primary text-xs disabled:opacity-50">
              {saving ? 'Salvataggio…' : 'Aggiungi'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={saving} className="btn-secondary text-xs disabled:opacity-50">Annulla</button>
          </div>
        </div>
      )}

      {/* Lista azioni */}
      {ricorrenti.length === 0 ? (
        <div className="card text-center py-10">
          <RefreshCw size={24} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">Nessuna azione ricorrente configurata</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ricorrenti.map(az => {
            const key = getPeriodoKey(az.frequenza)
            const completatiPeriodo = az.completamenti.filter(c => c.periodoKey === key)
            const mioCompletamento = az.completamenti.find(c => c.userId === currentUserId && c.periodoKey === key)
            const assigneeUser = staff.find(u => u.id === az.assegnato_a)
            const totalAssigned = az.assegnato_a ? 1 : staff.length
            const pct = totalAssigned > 0 ? Math.round((completatiPeriodo.length / totalAssigned) * 100) : 0
            const pctColor = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-gold' : 'text-red-700'

            return (
              <div key={az.id} className={`card flex items-start gap-4 ${!az.attiva ? 'opacity-40' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!mioCompletamento}
                  onChange={() => az.attiva && toggleCompletamento(az)}
                  disabled={!az.attiva || toggling === az.id}
                  className="mt-1 w-4 h-4 accent-gold cursor-pointer flex-shrink-0 disabled:cursor-wait"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${mioCompletamento ? 'line-through text-stone' : 'text-obsidian'}`}>
                    {az.titolo}
                  </p>
                  {az.descrizione && <p className="text-xs text-stone mt-0.5">{az.descrizione}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                      {FREQ_LABEL[az.frequenza] ?? az.frequenza}
                    </span>
                    <span className="text-xs text-stone">
                      {assigneeUser ? `${assigneeUser.nome} ${assigneeUser.cognome}` : 'Tutti'}
                    </span>
                    {totalAssigned > 0 ? (
                      <span className={`text-xs font-medium ${pctColor}`}>
                        {completatiPeriodo.length}/{totalAssigned} completate ({pct}%)
                      </span>
                    ) : (
                      <span className="text-xs text-stone/60 italic">Nessuno staff assegnato</span>
                    )}
                  </div>
                  {completatiPeriodo.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {completatiPeriodo.map((c, i) => (
                        <p key={i} className="text-xs text-stone/60">
                          ✓ {c.userName} — {new Date(c.data).toLocaleDateString('it-IT')}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleAttiva(az)}
                          className={`p-1.5 rounded transition-colors ${az.attiva ? 'text-green-700 hover:text-stone' : 'text-stone hover:text-green-700'}`}
                          title={az.attiva ? 'Disattiva' : 'Attiva'}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => deleteAzione(az)}
                          className="p-1.5 rounded text-stone hover:text-red-700 transition-colors"
                          title="Elimina">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
