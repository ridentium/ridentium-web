'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { roleLabel, roleColor, cn } from '@/lib/utils'
import {
  Save, CheckCircle, AlertCircle, Mail, Shield, Calendar,
  Phone, User, Bell, BellOff, Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { isPushSupported, subscribeUser, unsubscribeUser, getCurrentSubscription } from '@/lib/push'

interface Props {
  profilo: UserProfile
}

// Notification types per role
const NOTIF_TYPES = [
  {
    tipo: 'task_assegnata',
    label: 'Task assegnata',
    desc: 'Quando ti viene assegnato un nuovo task',
    roles: ['admin', 'staff', 'medico', 'assistente', 'receptionist'],
  },
  {
    tipo: 'stock_minimo',
    label: 'Scorte sotto soglia',
    desc: 'Quando un prodotto scende sotto la soglia minima',
    roles: ['admin'],
  },
  {
    tipo: 'ricorrente_scaduta',
    label: 'Azione ricorrente',
    desc: 'Quando una ricorrenza è in scadenza o in ritardo',
    roles: ['admin', 'staff', 'medico', 'assistente', 'receptionist'],
  },
]

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

  // Push subscription
  const [pushSupported, setPushSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Per-type preferences
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [prefsLoading, setPrefsLoading] = useState(false)

  const initials = `${profilo.nome[0] ?? ''}${profilo.cognome[0] ?? ''}`.toUpperCase()
  const dataIscrizione = new Date(profilo.created_at).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  // Notification types visible to this user's role
  const visibleTypes = NOTIF_TYPES.filter(t => t.roles.includes(profilo.ruolo))

  useEffect(() => {
    if (!isPushSupported()) return
    setPushSupported(true)
    getCurrentSubscription().then(sub => setIsSubscribed(!!sub))
  }, [])

  useEffect(() => {
    async function loadPrefs() {
      setPrefsLoading(true)
      const { data } = await supabase
        .from('user_notification_prefs')
        .select('tipo, abilitata')
        .eq('user_id', profilo.id)
      if (data) {
        const map: Record<string, boolean> = {}
        for (const row of data) map[row.tipo] = row.abilitata
        setPrefs(map)
      }
      setPrefsLoading(false)
    }
    loadPrefs()
  }, [profilo.id])

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
    if (telefono !== undefined) {
      updates.telefono = telefono.trim() || null
    }

    const { error: dbError } = await supabase
      .from('profili')
      .update(updates)
      .eq('id', profilo.id)

    setSaving(false)
    if (dbError) {
      if (dbError.message.includes('telefono')) {
        const { error: retryError } = await supabase
          .from('profili')
          .update({ nome: nome.trim(), cognome: cognome.trim() })
          .eq('id', profilo.id)
        if (retryError) { setError(`Errore: ${retryError.message}`); return }
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

  async function handleTogglePush() {
    setPushLoading(true)
    try {
      if (isSubscribed) {
        await unsubscribeUser(supabase)
        setIsSubscribed(false)
      } else {
        await subscribeUser(supabase)
        setIsSubscribed(true)
      }
    } catch (e) {
      console.error('Push toggle error:', e)
    }
    setPushLoading(false)
  }

  async function handleTogglePref(tipo: string, current: boolean) {
    const next = !current
    // Optimistic update
    setPrefs(p => ({ ...p, [tipo]: next }))
    const { error } = await supabase
      .from('user_notification_prefs')
      .upsert({ user_id: profilo.id, tipo, abilitata: next, updated_at: new Date().toISOString() },
               { onConflict: 'user_id,tipo' })
    if (error) {
      // revert
      setPrefs(p => ({ ...p, [tipo]: current }))
      console.error('Pref save error:', error)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar + info principale */}
      <div className="card flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center flex-shrink-0">
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
              <input className="input pl-9" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" />
            </div>
          </div>
          <div>
            <label className="label-field block mb-1.5">Cognome</label>
            <input className="input" value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Cognome" />
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

      {/* Notifiche push */}
      {pushSupported && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-obsidian-light pb-3">
            <h3 className="text-xs uppercase tracking-widest text-stone font-medium">
              Notifiche Push
            </h3>
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={cn(
                'flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50',
                isSubscribed
                  ? 'border-red-400/30 text-red-400 hover:bg-red-400/10'
                  : 'border-gold/30 text-gold hover:bg-gold/10'
              )}
            >
              {pushLoading
                ? <Loader2 size={12} className="animate-spin" />
                : isSubscribed ? <BellOff size={12} /> : <Bell size={12} />
              }
              {isSubscribed ? 'Disattiva notifiche' : 'Attiva notifiche'}
            </button>
          </div>

          {isSubscribed ? (
            <div className="space-y-3">
              <p className="text-xs text-stone">
                Scegli quali notifiche ricevere su questo dispositivo:
              </p>
              {prefsLoading ? (
                <div className="flex items-center gap-2 text-stone text-xs">
                  <Loader2 size={12} className="animate-spin" />
                  Caricamento preferenze…
                </div>
              ) : (
                visibleTypes.map(({ tipo, label, desc }) => {
                  const enabled = prefs[tipo] !== false // default: enabled
                  return (
                    <div key={tipo} className="flex items-center justify-between py-2 border-b border-obsidian-light/50 last:border-0">
                      <div>
                        <p className="text-sm text-cream">{label}</p>
                        <p className="text-xs text-stone mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => handleTogglePref(tipo, enabled)}
                        className={cn(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4',
                          enabled ? 'bg-gold' : 'bg-obsidian-light'
                        )}
                        role="switch"
                        aria-checked={enabled}
                      >
                        <span className={cn(
                          'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                          enabled ? 'translate-x-4' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <p className="text-xs text-stone">
              Attiva le notifiche push per ricevere aggiornamenti in tempo reale su questo dispositivo.
            </p>
          )}
        </div>
      )}

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
              <CheckCircle size={13} />
              Email inviata
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
