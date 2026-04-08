'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, UserRole } from '@/types'
import { roleLabel, roleColor } from '@/lib/utils'
import { UserPlus, X, Mail, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StaffManager({ staff }: { staff: UserProfile[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showInvite, setShowInvite] = useState(false)

  async function toggleAttivo(id: string, attivo: boolean) {
    await supabase.from('profili').update({ attivo: !attivo }).eq('id', id)
    startTransition(() => router.refresh())
  }

  async function changeRuolo(id: string, ruolo: UserRole) {
    await supabase.from('profili').update({ ruolo }).eq('id', id)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setShowInvite(true)}
                className="btn-primary flex items-center gap-1.5 text-xs">
          <UserPlus size={13} /> Aggiungi membro
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-ridentium">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map(member => (
              <tr key={member.id} className={!member.attivo ? 'opacity-40' : ''}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20
                                    flex items-center justify-center text-gold text-xs font-medium">
                      {member.nome[0]}{member.cognome[0]}
                    </div>
                    <span className="text-cream font-medium">
                      {member.nome} {member.cognome}
                    </span>
                  </div>
                </td>
                <td className="text-stone">{member.email}</td>
                <td>
                  <select
                    value={member.ruolo}
                    onChange={e => changeRuolo(member.id, e.target.value as UserRole)}
                    className="bg-transparent border border-obsidian-light rounded px-2 py-1
                               text-xs focus:outline-none focus:border-gold transition-colors"
                  >
                    <option value="admin">Admin</option>
                    <option value="aso">ASO</option>
                    <option value="segretaria">Segreteria</option>
                    <option value="manager">Manager</option>
                  </select>
                </td>
                <td>
                  <span className={`text-xs font-medium ${member.attivo ? 'text-green-400' : 'text-stone'}`}>
                    {member.attivo ? '● Attivo' : '○ Disattivo'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => toggleAttivo(member.id, member.attivo ?? true)}
                    className="btn-ghost text-xs px-2 py-1"
                  >
                    {member.attivo ? 'Disattiva' : 'Riattiva'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSave={() => { setShowInvite(false); startTransition(() => router.refresh()) }}
        />
      )}
    </div>
  )
}

function InviteModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ email: '', nome: '', cognome: '', ruolo: 'aso', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleCreate() {
    if (!form.email || !form.nome || !form.password) {
      setError('Compila tutti i campi obbligatori')
      return
    }
    setSaving(true)
    setError('')

    // Crea utente via Supabase Admin API (richiede service role — da fare lato server)
    // Per ora, invita via email con metadata
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { nome: form.nome, cognome: form.cognome, ruolo: form.ruolo }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">Nuovo membro staff</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field block mb-1.5">Nome *</label>
              <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} />
            </div>
            <div>
              <label className="label-field block mb-1.5">Cognome</label>
              <input className="input" value={form.cognome} onChange={e => set('cognome', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-field block mb-1.5">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label-field block mb-1.5">Password temporanea *</label>
            <input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)}
                   placeholder="Min. 6 caratteri" />
          </div>
          <div>
            <label className="label-field block mb-1.5">Ruolo</label>
            <select className="input" value={form.ruolo} onChange={e => set('ruolo', e.target.value)}>
              <option value="aso">ASO</option>
              <option value="segretaria">Segreteria</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annulla</button>
          <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Creazione…' : 'Crea account'}
          </button>
        </div>
      </div>
    </div>
  )
}
