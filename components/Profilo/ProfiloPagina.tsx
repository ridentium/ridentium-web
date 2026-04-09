'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { roleLabel, roleColor, cn } from '@/lib/utils'
import { Save, CheckCircle, AlertCircle, Mail, Shield, Calendar, Phone, User } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  profilo: UserProfile
}

export default function ProfiloPagina({ profilo }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [nome, setNome] = useState(profilo.nome)
  const [cognome, setCognome] = useState(profilo.cognome)
  const [telefono, setTelefono] = useState(profilo.telefono ?? '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  const initials = `${profilo.nome[0] ?? ''}${profilo.cognome[0] ?? ''}`.toUpperCase()
  const dataIscrizione = new Date(profilo.created_at).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  async function handleSave() {
    if (!nome.trim() || !cognome.trim()) {
      setError('Nome e cognome sono obbligatori.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)

    const updates: Record<string, string | null> = {
      nome: nome.trim(),
      cognome: cognome.trim(),
    }
    // Aggiorna telefono solo se la colonna esiste nel DB
    if (telefono !== undefined) {
      updates.telefono = telefono.trim() || null
    }

    const { error: dbError } = await supabase
      .from('profili')
      .update(updates)
      .eq('id', profilo.id)

    setSaving(false)

    if (dbError) {
      // Se telefono non esiste nella tabella, riprova senza
      if (dbError.message.includes('telefono')) {
        const { error: retryError } = await supabase
          .from('profili')
          .update({ nome: nome.trim(), cognome: cognome.trim() })
          .eq('id', profilo.id)
        if (retryError) {
          setError(`Errore: ${retryError.message}`)
          return
        }
      } else {
        setError(`Errore nel salvataggio: ${dbError.message}`)
        return
      }
    }

    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    router.refresh()
  }

  async function handlePasswordReset() {
    await supabase.auth.resetPasswordForEmail(profilo.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/profilo`,
    })
    setResetSent(true)
    setTimeout(() => setResetSent(false), 5000)
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Avatar + info principale */}
      <div className="card flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gold/15 border-2 border-gold/30
                        flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-2xl text-gold font-light tracking-wider">
            {initials}
          </span>
        </div>
        <div>
          <h2 className="font-serif text-2xl text-cream font-light tracking-wide">
            {profilo.nome} {profilo.cognome}
          </h2>
          <span className={cn('text-xs font-medium uppercase tracking-widest mt-1 inline-block', roleColor(profilo.ruolo))}>
            {roleLabel(profilo.ruolo)}
          </span>
          <p className="text-stone text-xs mt-1.5 flex items-center gap-1.5">
            <Calendar size={11} />
            Membro dal {dataIscrizione}
          </p>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded bg-ok/10 border border-ok/30 text-green-400 text-sm">
          <CheckCircle size={15} />
          Profilo aggiornato con successo.
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded bg-alert/10 border border-alert/30 text-red-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Dati modificabili */}
      <div className="card space-y-5">
        <h3 className="text-xs uppercase tracking-widest text-stone font-medium border-b border-obsidian-light pb-3">
          Dati Anagrafici
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field block mb-1.5">Nome</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone pointer-events-none" />
              <input
                className="input pl-9"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome"
              />
            </div>
          </div>
          <div>
            <label className="label-field block mb-1.5">Cognome</label>
            <input
              className="input"
              value={cognome}
              onChange={e => setCognome(e.target.value)}
              placeholder="Cognome"
            />
          </div>
        </div>

        <div>
          <label className="label-field block mb-1.5">Telefono</label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone pointer-events-none" />
            <input
              className="input pl-9"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+39 333 1234567"
              type="tel"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>

      {/* Dati read-only */}
      <div className="card space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-stone font-medium border-b border-obsidian-light pb-3">
          Account
        </h3>

        <div>
          <label className="label-field block mb-1.5">Email</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone pointer-events-none" />
            <div className="input pl-9 text-stone/70 cursor-not-allowed select-none">
              {profilo.email}
            </div>
          </div>
          <p className="text-xs text-stone/50 mt-1">L&apos;email non può essere modificata da qui.</p>
        </div>

        <div>
          <label className="label-field block mb-1.5">Ruolo</label>
          <div className="relative">
            <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone pointer-events-none" />
            <div className="input pl-9 text-stone/70 cursor-not-allowed select-none">
              {roleLabel(profilo.ruolo)}
            </div>
          </div>
          <p className="text-xs text-stone/50 mt-1">Il ruolo viene assegnato dall&apos;amministratore.</p>
        </div>
      </div>

      {/* Sicurezza */}
      <div className="card space-y-4">
        <h3 className="text-xs uppercase tracking-widest text-stone font-medium border-b border-obsidian-light pb-3">
          Sicurezza
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cream text-sm font-medium">Password</p>
            <p className="text-stone text-xs mt-0.5">
              Riceverai un&apos;email con il link per cambiare la password.
            </p>
          </div>
          {resetSent ? (
            <span className="flex items-center gap-1.5 text-green-400 text-xs">
              <CheckCircle size={13} /> Email inviata
            </span>
          ) : (
            <button onClick={handlePasswordReset} className="btn-secondary text-xs">
              Cambia password
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
