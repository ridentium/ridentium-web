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

  async function toggleCompletamento(az: Ricorrente) {
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
    if (!newTitolo.trim()) return
    const nuova = {
      titolo: newTitolo.trim(),
      descrizione: newDesc.trim() || null,
      frequenza: newFreq,
      assegnato_a: newAssignee === 'null' ? null : newAssignee,
      attiva: true,
      completamenti: [],
    }
    await supabase.from('ricorrenti').insert(nuva)
    await logActivity(currentUserId, currentUserNome,
      'Azione ricorrente creata', `${newTitolo} (${newFreq})`, 'ricorrenti')
    setNewTitolo(''); setNewDesc(''); setNewFreq('giornaliero'); setNewAssignee('null')
    setShowForm(false)
    startTransition(() => router.refresh())
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
      { showForm && (
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
            <button onClick={addAzione} className="btn-primary text-xs">Aggiungi</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Annulla</button>
          </div>
        </div>
      }

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