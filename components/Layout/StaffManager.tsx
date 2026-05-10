'use client'

import { useState, useTransition, useEffect } from 'react'
import { UserProfile, UserRole } from '@/types'
import { roleLabel, roleColor, cn } from '@/lib/utils'
import { UserPlus, X, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createStaffAccount,
  updateStaffRole,
  toggleStaffAttivo,
  deleteStaffAccount,
} from '@/app/actions/staff'

const RUOLI: { value: UserRole; label: string }[] = [
  { value: 'aso', label: 'ASO' },
  { value: 'segretaria', label: 'Segreteria' },
  { value: 'manager', label: 'Manager' },
  { value: 'clinico', label: 'Clinico' },
  { value: 'admin', label: 'Admin' },
]

export default function StaffManager({ staff }: { staff: UserProfile[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showInvite, setShowInvite] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [roleTarget, setRoleTarget] = useState<{ member: UserProfile; ruolo: UserRole } | null>(null)
  const [actionError, setActionError] = useState('')

  async function confirmRoleChange() {
    if (!roleTarget) return
    setActionError('')
    const res = await updateStaffRole(roleTarget.member.id, roleTarget.ruolo)
    setRoleTarget(null)
    if (res.error) setActionError(res.error)
    else startTransition(() => router.refresh())
  }

  function handleRoleChange(member: UserProfile, ruolo: UserRole) {
    if (ruolo === member.ruolo) return // nessun cambiamento
    setRoleTarget({ member, ruolo })
  }

  async function handleToggleAttivo(id: string, attivo: boolean) {
    setActionError('')
    const res = await toggleStaffAttivo(id, attivo)
    if (res.error) setActionError(res.error)
    else startTransition(() => router.refresh())
  }

  async function handleDelete(userId: string) {
    setActionError('')
    const res = await deleteStaffAccount(userId)
    setDeleteTarget(null)
    if (res.error) setActionError(res.error)
    else startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary flex items-center gap-1.5 text-xs"
        >
          <UserPlus size={13} />
          Aggiungi membro
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-400/10 border border-red-400/20 text-red-400 text-xs">
          <AlertTriangle size={12} />
          {actionError}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-ridentium min-w-[600px]">
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
                      <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-xs font-medium flex-shrink-0">
                        {member.nome[0]}{member.cognome[0]}
                      </div>
                      <div>
                        <p className="text-obsidian font-medium text-sm">
                          {member.nome} {member.cognome}
                        </p>
                        {member.telefono && (
                          <p className="text-stone/50 text-xs">{member.telefono}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-stone text-sm">{member.email}</td>
                  <td>
                    <select
                      value={member.ruolo}
                      onChange={e => handleRoleChange(member, e.target.value as UserRole)}
                      disabled={isPending}
                      className="bg-cream border border-taupe rounded px-2 py-1 text-xs focus:outline-none focus:border-gold transition-colors disabled:opacity-50 text-obsidian"
                    >
                      {RUOLI.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`text-xs font-medium ${member.attivo ? 'text-green-700' : 'text-stone'}`}>
                      {member.attivo ? '● Attivo' : '○ Disattivo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleAttivo(member.id, !!member.attivo)}
                        disabled={isPending}
                        className="btn-ghost text-xs px-2 py-1 disabled:opacity-50"
                      >
                        {member.attivo ? 'Disattiva' : 'Riattiva'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(member)}
                        disabled={isPending}
                        className="btn-ghost text-xs px-2 py-1 text-red-400/60 hover:text-red-400 disabled:opacity-50"
                        title="Elimina account"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div>
                <p className="text-obsidian font-medium text-sm">Elimina account</p>
                <p className="text-stone/60 text-xs">Questa azione è irreversibile</p>
              </div>
            </div>
            <p className="text-stone text-sm mb-5">
              Sei sicuro di voler eliminare l&apos;account di{' '}
              <span className="text-obsidian font-medium">
                {deleteTarget.nome} {deleteTarget.cognome}
              </span>
              ? Verranno eliminati anche tutti i dati associati.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 text-sm">
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                className="flex-1 px-4 py-2 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conferma cambio ruolo */}
      {roleTarget && (
        <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-amber-400/10 flex items-center justify-center">
                <AlertTriangle size={16} className="text-amber-400" />
              </div>
              <div>
                <p className="text-obsidian font-medium text-sm">Cambia ruolo</p>
                <p className="text-stone/60 text-xs">Questa azione modifica i permessi di accesso</p>
              </div>
            </div>
            <p className="text-stone text-sm mb-5">
              Vuoi cambiare il ruolo di{' '}
              <span className="text-obsidian font-medium">
                {roleTarget.member.nome} {roleTarget.member.cognome}
              </span>
              {' '}a <span className="text-gold font-medium">{RUOLI.find(r => r.value === roleTarget.ruolo)?.label ?? roleTarget.ruolo}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRoleTarget(null)} className="btn-secondary flex-1 text-sm">
                Annulla
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={isPending}
                className="flex-1 px-4 py-2 rounded bg-gold/15 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/25 transition-colors disabled:opacity-50"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSave={() => {
            setShowInvite(false)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}

function InviteModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    email: '',
    nome: '',
    cognome: '',
    telefono: '',
    ruolo: 'aso' as UserRole,
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ nome: string; cognome: string } | null>(null)

  // Auto-chiudi e aggiorna lista 1.8 secondi dopo il successo
  useEffect(() => {
    if (!created) return
    const t = setTimeout(() => onSave(), 1800)
    return () => clearTimeout(t)
  }, [created, onSave])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleCreate() {
    if (saving) return // guard doppio-click
    if (!form.email || !form.nome || !form.password) {
      setError('Email, nome e password sono obbligatori')
      return
    }
    if (form.password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri')
      return
    }
    setSaving(true)
    setError('')

    const res = await createStaffAccount({
      email: form.email,
      password: form.password,
      nome: form.nome,
      cognome: form.cognome,
      ruolo: form.ruolo,
      telefono: form.telefono || undefined,
    })

    setSaving(false)
    if (res.error) {
      setError(res.error)
    } else {
      setCreated({ nome: form.nome, cognome: form.cognome })
    }
  }

  // Pannello di successo — visibile per 1.8s poi si chiude automaticamente
  if (created) {
    return (
      <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card w-full max-w-md text-center py-8 px-6">
          <div className="flex justify-center mb-4">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <p className="text-obsidian font-medium text-lg mb-1">Account creato</p>
          <p className="text-stone text-sm">
            <span className="text-obsidian font-medium">{created.nome} {created.cognome}</span>{' '}
            è ora nel team. La pagina si aggiornerà automaticamente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title text-lg">Nuovo membro staff</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={16} />
          </button>
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
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          <div>
            <label className="label-field block mb-1.5">Telefono</label>
            <input
              type="tel"
              className="input"
              value={form.telefono}
              onChange={e => set('telefono', e.target.value)}
              placeholder="Opzionale"
            />
          </div>

          <div>
            <label className="label-field block mb-1.5">Password temporanea *</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Min. 6 caratteri"
            />
          </div>

          <div>
            <label className="label-field block mb-1.5">Ruolo</label>
            <select
              className="input"
              value={form.ruolo}
              onChange={e => set('ruolo', e.target.value)}
            >
              {RUOLI.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annulla
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Creazione…' : 'Crea account'}
          </button>
        </div>
      </div>
    </div>
  )
}
