'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, BellOff, BellRing, Check, Smartphone, Trash2, AlertTriangle, RefreshCw, CheckSquare, Zap } from 'lucide-react'
import NotificationBell from '@/components/Layout/NotificationBell'
import { useRouter } from 'next/navigation'

const TIPO_INFO: Record<string, { label: string; description: string; icon: React.ElementType; color: string }> = {
  stock_minimo: {
    label: 'Scorte sotto soglia',
    description: 'Notifica quando un prodotto in magazzino scende sotto la quantità minima',
    icon: AlertTriangle,
    color: 'text-red-400',
  },
  task_assegnata: {
    label: 'Task assegnata',
    description: 'Notifica quando viene assegnato un nuovo task',
    icon: CheckSquare,
    color: 'text-blue-400',
  },
  ricorrente_scaduta: {
    label: 'Azione ricorrente in scadenza',
    description: 'Notifica quando un\'azione ricorrente è in scadenza oggi',
    icon: RefreshCw,
    color: 'text-amber-400',
  },
}

const RUOLI_OPTIONS = ['admin', 'staff', 'responsabile']

interface NotificheSetting {
  id: string
  tipo: string
  abilitata: boolean
  ruoli_destinatari: string[]
}

interface PushSubscription {
  id: string
  user_id: string
  ruolo: string
  created_at: string
  endpoint: string
}

interface Props {
  settings: NotificheSetting[]
  subscriptions: PushSubscription[]
}

export default function NotificheAdmin({ settings, subscriptions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const [saving, setSaving] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  // Local copy for optimistic UI
  const [localSettings, setLocalSettings] = useState<NotificheSetting[]>(settings)

  async function toggleAbilitata(setting: NotificheSetting) {
    setSaving(setting.tipo)
    const newVal = !setting.abilitata
    setLocalSettings(prev =>
      prev.map(s => s.tipo === setting.tipo ? { ...s, abilitata: newVal } : s)
    )
    const { error } = await supabase
      .from('notification_settings')
      .update({ abilitata: newVal, updated_at: new Date().toISOString() })
      .eq('tipo', setting.tipo)
    if (error) {
      // Revert
      setLocalSettings(prev =>
        prev.map(s => s.tipo === setting.tipo ? { ...s, abilitata: !newVal } : s)
      )
    }
    setSaving(null)
  }

  async function toggleRuolo(setting: NotificheSetting, ruolo: string) {
    setSaving(setting.tipo + ruolo)
    const current = setting.ruoli_destinatari ?? []
    const newRuoli = current.includes(ruolo)
      ? current.filter(r => r !== ruolo)
      : [...current, ruolo]

    setLocalSettings(prev =>
      prev.map(s => s.tipo === setting.tipo ? { ...s, ruoli_destinatari: newRuoli } : s)
    )
    await supabase
      .from('notification_settings')
      .update({ ruoli_destinatari: newRuoli, updated_at: new Date().toISOString() })
      .eq('tipo', setting.tipo)
    setSaving(null)
  }

  async function sendTestNotification() {
    setSaving('test')
    setTestResult(null)
    try {
      const res = await fetch('/api/notify/stock')
      const data = await res.json()
      if (data.alerts > 0) {
        setTestResult(`Inviate notifiche per ${data.alerts} prodotti sotto soglia`)
      } else {
        setTestResult('Nessun prodotto sotto soglia al momento')
      }
    } catch {
      setTestResult('Errore durante il controllo')
    }
    setSaving(null)
  }

  async function removeSubscription(id: string) {
    await supabase.from('push_subscriptions').delete().eq('id', id)
    startTransition(() => router.refresh())
  }

  const subscribedCount = subscriptions.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title text-2xl">Notifiche</h1>
          <p className="text-stone text-sm mt-1">Configura le notifiche push per l&apos;app</p>
        </div>
        <NotificationBell />
      </div>

      {/* Stato attivazione su questo dispositivo */}
      <div className="card flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
          <Smartphone size={18} className="text-gold" />
        </div>
        <div className="flex-1">
          <h2 className="text-cream font-medium text-sm">Questo dispositivo</h2>
          <p className="text-stone text-xs mt-0.5">
            Usa il pulsante a destra per attivare o disattivare le notifiche push su questo dispositivo.
            Ogni utente può gestire il proprio dispositivo dal profilo.
          </p>
        </div>
        <NotificationBell className="flex-shrink-0" />
      </div>

      {/* Configurazione tipi di notifica */}
      <div>
        <h2 className="label-field mb-3">Tipi di notifica</h2>
        <div className="space-y-3">
          {localSettings.map(setting => {
            const info = TIPO_INFO[setting.tipo]
            if (!info) return null
            const Icon = info.icon
            const isSaving = saving === setting.tipo

            return (
              <div key={setting.tipo} className="card space-y-3">
                {/* Row 1: toggle + label */}
                <div className="flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${setting.abilitata ? 'bg-gold/10 border border-gold/20' : 'bg-obsidian-light/30 border border-obsidian-light/50'}`}>
                    <Icon size={16} className={setting.abilitata ? info.color : 'text-stone/40'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`font-medium text-sm ${setting.abilitata ? 'text-cream' : 'text-stone/60'}`}>
                        {info.label}
                      </p>
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleAbilitata(setting)}
                        disabled={isSaving}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                                    ${setting.abilitata ? 'bg-gold' : 'bg-obsidian-light'}
                                    ${isSaving ? 'opacity-60' : ''}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-cream shadow transition-transform
                                          ${setting.abilitata ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <p className="text-stone text-xs mt-0.5">{info.description}</p>
                  </div>
                </div>

                {/* Row 2: role selection (only when enabled) */}
                {setting.abilitata && (
                  <div className="pl-13 ml-13">
                    <p className="text-xs text-stone mb-2">Invia a:</p>
                    <div className="flex flex-wrap gap-2">
                      {RUOLI_OPTIONS.map(ruolo => {
                        const active = setting.ruoli_destinatari?.includes(ruolo)
                        const key = setting.tipo + ruolo
                        return (
                          <button
                            key={ruolo}
                            onClick={() => toggleRuolo(setting, ruolo)}
                            disabled={saving === key}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors
                                        ${active
                                          ? 'bg-gold/20 border-gold/40 text-gold'
                                          : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                                        } ${saving === key ? 'opacity-60' : ''}`}
                          >
                            {active && <Check size={10} />}
                            {ruolo.charAt(0).toUpperCase() + ruolo.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Test scorte */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-cream font-medium text-sm">Test — Controllo scorte</h2>
            <p className="text-stone text-xs mt-0.5">
              Controlla immediatamente le scorte e invia notifiche se ci sono prodotti sotto soglia
            </p>
          </div>
          <button
            onClick={sendTestNotification}
            disabled={saving === 'test'}
            className="btn-secondary flex items-center gap-2 text-xs flex-shrink-0"
          >
            {saving === 'test' ? (
              <><RefreshCw size={13} className="animate-spin" /> Controllo…</>
            ) : (
              <><Zap size={13} /> Controlla ora</>
            )}
          </button>
        </div>
        {testResult && (
          <div className="flex items-center gap-2 text-xs text-stone bg-obsidian-light/30 rounded px-3 py-2 mt-2">
            <Check size={12} className="text-green-400 flex-shrink-0" />
            {testResult}
          </div>
        )}
      </div>

      {/* Dispositivi registrati */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="label-field">Dispositivi registrati ({subscribedCount})</h2>
        </div>
        {subscriptions.length === 0 ? (
          <div className="card text-center py-8">
            <BellOff size={24} className="text-stone/30 mx-auto mb-2" />
            <p className="text-stone text-sm">Nessun dispositivo registrato</p>
            <p className="text-stone/60 text-xs mt-1">
              Attiva le notifiche sul tuo dispositivo tramite il pulsante qui sopra
            </p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            {subscriptions.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 px-5 py-3 border-b border-obsidian-light/40 last:border-0">
                <Smartphone size={14} className="text-stone flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-sm font-medium capitalize">{sub.ruolo}</p>
                  <p className="text-stone/50 text-xs truncate">{sub.endpoint.split('/').pop()?.slice(0, 40)}…</p>
                  <p className="text-stone/40 text-xs">
                    Registrato il {new Date(sub.created_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <button
                  onClick={() => removeSubscription(sub.id)}
                  className="btn-ghost p-1.5 text-stone/40 hover:text-red-400 flex-shrink-0"
                  title="Rimuovi dispositivo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
