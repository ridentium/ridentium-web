'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ricorrente, UserProfile } from '@/types'
import { Plus, Trash2, Power, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function getPeriodoKey(frequenza: string): string {
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
  // Formato custom: ogni_N_giorni | ogni_N_settimane | ogni_N_mesi
  const m = frequenza.match(/^ogni_(\d+)_(giorni|settimane|mesi)$/)
  if (m) {
    const n = parseInt(m[1])
    const unita = m[2]
    const epoch = new Date('2024-01-01').getTime()
    if (unita === 'giorni') {
      const days = Math.floor((now.getTime() - epoch) / 86400000)
      return 'D' + n + '_' + Math.floor(days / n)
    }
    if (unita === 'settimane') {
      const weeks = Math.floor((now.getTime() - epoch) / (7 * 86400000))
      return 'W' + n + '_' + Math.floor(weeks / n)
    }
    if (unita === 'mesi') {
      const totalMesi = now.getFullYear() * 12 + now.getMonth()
      const epochMesi = 2024 * 12
      return 'M' + n + '_' + Math.floor((totalMesi - epochMesi) / n)
    }
  }
  return now.toISOString().split('T')[0]
}

function freqLabel(frequenza: string): string {
  if (frequenza === 'giornaliero') return 'Ogni giorno'
  if (frequenza === 'settimanale') return 'Ogni settimana'
  if (frequenza === 'mensile') return 'Ogni mese'
  const m = frequenza.match(/^ogni_(\d+)_(giorni|settimane|mesi)$/)
  if (m) {
    const n = parseInt(m[1])
    const unita = m[2]
    if (n === 1) {
      if (unita === 'giorni') return 'Ogni giorno'
      if (unita === 'settimane') return 'Ogni settimana'
      if (unita === 'mesi') return 'Ogni mese'
    }
    return `Ogni ${n} ${unita}`
  }
  return frequenza
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
  const [, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [newTitolo, setNewTitolo] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [freqTipo, setFreqTipo] = useState<'standard' | 'custom'>('standard')
  const [freqStandard, setFreqStandard] = useState('giornaliero')
  const [freqNumero, setFreqNumero] = useState('2')
  const [freqUnita, setFreqUnita] = useState('settimane')
  const [newAssignee, setNewAssignee] = useState<string>('null')

  const freqValue = freqTipo === 'standard' ? freqStandard : `ogni_${freqNumero}_${freqUnita}`

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
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: idx >= 0 ? 'Azione ricorrente rimossa' : 'Azione ricorrente completata',
      dettaglio: az.titolo, categoria: 'ricorrenti'
    })
    startTransition(() => router.refresh())
  }

  async function toggleAttiva(az: Ricorrente) {
    await supabase.from('ricorrenti').update({ attiva: !az.attiva }).eq('id', az.id)
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: az.attiva ? 'Azione ricorrente disattivata' : 'Azione ricorrente attivata',
      dettaglio: az.titolo, categoria: 'ricorrenti'
    })
    startTransition(() => router.refresh())
  }

  async function deleteAzione(az: Ricorrente) {
    if (!confirm(`Eliminare "${az.titolo}"?`)) return
    await supabase.from('ricorrenti').delete().eq('id', az.id)
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: 'Azione ricorrente eliminata', dettaglio: az.titolo, categoria: 'ricorrenti'
    })
    startTransition(() => router.refresh())
  }

  async function addAzione() {
    if (!newTitolo.trim()) return
    const nuova = {
      titolo: newTitolo.trim(),
      descrizione: newDesc.trim() || null,
      frequenza: freqValue,
      assegnato_a: newAssignee === 'null' ? null : newAssignee,
      attiva: true,
      completamenti: [],
    }
    await supabase.from('ricorrenti').insert(nuova)
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: 'Azione ricorrente creata',
      dettaglio: newTitolo + ' (' + freqLabel(freqValue) + ')',
      categoria: 'ricorrenti'
    })
    setNewTitolo(''); setNewDesc('')
    setFreqTipo('standard'); setFreqStandard('giornaliero')
    setFreqNumero('2'); setFreqUnita('settimane')
    setNewAssignee('null')
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-stone">
          <RefreshCw size={12} />
          <span>{ricorrenti.filter(a => a.attiva).length} azioni attive</span>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Nuova azione
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Nuova azione ricorrente</h3>
          <input className="input" placeholder="Titolo" value={newTitolo} onChange={e => setNewTitolo(e.target.value)} />
          <input className="input" placeholder="Descrizione (opzionale)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />

          {/* Frequenza */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setFreqTipo('standard')}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${freqTipo === 'standard' ? 'bg-gold text-obsidian border-gold' : 'border-obsidian-light text-stone hover:border-stone'}`}>
                Standard
              </button>
              <button
                onClick={() => setFreqTipo('custom')}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${freqTipo === 'custom' ? 'bg-gold text-obsidian border-gold' : 'border-obsidian-light text-stone hover:border-stone'}`}>
                Personalizzata
              </button>
            </div>
            {freqTipo === 'standard' ? (
              <select className="input" value={freqStandard} onChange={e => setFreqStandard(e.target.value)}>
                <option value="giornaliero">Ogni giorno</option>
                <option value="settimanale">Ogni settimana</option>
                <option value="mensile">Ogni mese</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone">Ogni</span>
                <input
                  type="number" min="1" max="365"
                  className="input w-20 text-center"
                  value={freqNumero}
                  onChange={e => setFreqNumero(e.target.value)}
                />
                <select className="input" value={freqUnita} onChange={e => setFreqUnita(e.target.value)}>
                  <option value="giorni">giorni</option>
                  <option value="settimane">settimane</option>
                  <option value="mesi">mesi</option>
                </select>
              </div>
            )}
            <p className="text-xs text-stone">
              Frequenza: <span className="text-gold">{freqLabel(freqValue)}</span>
            </p>
          </div>

          <select className="input" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
            <option value="null">Tutti lo staff</option>
            {staff.map(u => <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>)}
          </select>
          <div className="flex gap-3">
            <button onClick={addAzione} className="btn-primary text-xs">Aggiungi</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Annulla</button>
          </div>
        </div>
      )}

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
                  disabled={!az.attiva}
                  className="mt-1 w-4 h-4 accent-gold cursor-pointer flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${mioCompletamento ? 'line-through text-stone' : 'text-cream'}`}>
                    {az.titolo}
                  </p>
                  {az.descrizione && <p className="text-xs text-stone mt-0.5">{az.descrizione}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
                      {freqLabel(az.frequenza)}
                    </span>
                    <span className="text-xs text-stone">
                      {assigneeUser ? `${assigneeUser.nome} ${assigneeUser.cognome}` : 'Tutti'}
                    </span>
                    <span className={`text-xs font-medium ${pctColor}`}>
                      {completatiPeriodo.length}/{totalAssigned} completate ({pct}%)
                    </span>
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
                  <button
                    onClick={() => toggleAttiva(az)}
                    className={`p-1.5 rounded transition-colors ${az.attiva ? 'text-green-400 hover:text-stone' : 'text-stone hover:text-green-400'}`}
                    title={az.attiva ? 'Disattiva' : 'Attiva'}>
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => deleteAzione(az)}
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
