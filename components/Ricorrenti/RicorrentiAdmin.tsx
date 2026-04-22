'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ricorrente, UserProfile } from '@/types'
import { Plus, Trash2, Power, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'

const FREQ_LABEL: Record<string, string> = {
  giornaliero: 'Giornaliero',
  settimanale: 'Settimanale',
  mensile: 'Mensile',
}

function getPeriodoKey(frequenza: string): string {
  const now = new Date()
  if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
  if (frequenza === 'settimanale') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() + 1)
    return 'W' + d.toISOString().split('T')[0]
  }
  if (frequenza === 'mensile') {
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  }
  return now.toISOString().split('T')[0]
}

interface Props {
  ricorrenti: Ricorrente[]
  staff: UserProfile[]
  currentUserId: string
  currentUserNome: string
}

export default function RicorrentiAdmin({ ricorrenti, staff, currentUserId, currentUserNome }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [newTitolo, setNewTitolo] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFreq, setNewFreq] = useState<'giornaliero' | 'settimanale' | 'mensile'>('giornaliero')
  const [newAssignee, setNewAssignee] = useState<string>('null')
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function toggleCompletamento(az: Ricorrente) {
    if (toggling === az.id) return // guard doppio-click: evita duplicati nel JSON completamenti
    setToggling(az.id)
    try {
      const key = getPeriodoKey(az.frequenza)
      const completamenti = [...az.completamenti]
      const idx = completamenti.findIndex(c => c.userId === currentUserId && c.periodoKey === key)
      if (idx >= 0) {
        completamenti.splice(idx, 1)
      } else {
        completamenti.push({ userId: currentUserId, userName: currentUserNome, periodoKey: key, data: new Date().toISOString() })
      }
      await supabase.from('ricorrenti').update({ completamenti }).eq('id', az.id)
      await logActivity(currentUserId, currentUserNome,
        idx >= 0 ? 'Azione ricorrente rimossa' : 'Azione ricorrente completata',
        az.titolo, 'ricorrenti')
      startTransition(() => router.refresh())
    } finally {
      setToggling(null)
    }
  }

  async function toggleAttiva(az: Ricorrente) {
    await supabase.from('ricorrenti').update({ attiva: !az.attiva }).eq('id', az.id)
    await logActivity(currentUserId, currentUserNome,
      az.attiva ? 'Azione ricorrente disattivata' : 'Azione ricorrente attivata',
      az.titolo, 'ricorrenti')
    startTransition(() => router.refresh())
  }

  async function deleteAzione(az: Ricorrente) {
    if (!confirm(`Eliminare "${az.titolo}"?`)) return
    await supabase.from('ricorrenti').delete().eq('id', az.id)
    await logActivity(currentUserId, currentUserNome,
      'Azione ricorrente eliminata', az.titolo, 'ricorrenti')
    startTransition(() => router.refresh())
  }

  async function addAzione() {
    if (saving) return // guard doppio-click
    if (!newTitolo.trim()) return
    setSaving(true)
    try {
      const nuova = {
        titolo: newTitolo.trim(),
        descrizione: newDesc.trim() || null,
        frequenza: newFreq,
        assegnato_a: newAssignee === 'null' ? null : newAssignee,
        attiva: true,
        completamenti: [],
      }
      await supabase.from('ricorrenti').insert(nuova)
      await logActivity(currentUserId, currentUserNome,
        'Azione ricorrente creata', `${newTitolo} (${newFreq})`, 'ricorrenti')
      setNewTitolo(''); setNewDesc(''); setNewFreq('giornaliero'); setNewAssignee('null')
      setShowForm(false)
      startTransition(() => router.refresh())
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
            <select className="input" value={newFreq} onChange={e => setNewFreq(e.target.value as any)}>
              <option value="giornaliero">Giornaliero</option>
              <option value="settimanale">Settimanale</option>
              <option value="mensile">Mensile</option>
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
            const pctColor = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-gold' : 'text-red-400'

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
                  <p className={`text-sm font-medium ${mioCompletamento ? 'line-through text-stone' : 'text-cream'}`}>
                    {az.titolo}
                  </p>
                  {az.descrizione && <p className="text-xs text-stone mt-0.5">{az.descrizione}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                      {FREQ_LABEL[az.frequenza]}
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
                          className={`p-1.5 rounded transition-colors ${az.attiva ? 'text-green-400 hover:text-stone' : 'text-stone hover:text-green-400'}`}
                          title={az.attiva ? 'Disattiva' : 'Attiva'}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => deleteAzione(az)}
                          className="p-1.5 rounded text-stone hover:text-red-400 transition-colors"
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
