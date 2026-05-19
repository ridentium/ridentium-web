import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Settings2 } from 'lucide-react'
import PageHeader from '@/components/Layout/PageHeader'
import ImpostazioniAdmin from '@/components/Impostazioni/ImpostazioniAdmin'
import PermessiAdmin from '@/components/Impostazioni/PermessiAdmin'
import ImpostazioniStudio from '@/components/Impostazioni/ImpostazioniStudio'
import SettingsOperativi from '@/components/Impostazioni/SettingsOperativi'
import { getAllSettings, SETTING_DEFAULTS } from '@/lib/settings'

export default async function ImpostazioniAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()

  const [
    { data: kpi },
    { data: permessi },
    { data: profilo },
    allSettings,
  ] = await Promise.all([
    supabase.from('kpi').select('*').single(),
    adminDb.from('sezione_permessi').select('sezione, ruolo, visibile').order('sezione'),
    adminDb.from('profili').select('ruolo').eq('id', user.id).single(),
    getAllSettings(),
  ])

  const ruolo = profilo?.ruolo ?? 'aso'
  const isReadOnly = !['admin', 'manager'].includes(ruolo)

  // Merge con defaults — garantisce tutti i campi anche se il DB manca qualche chiave
  const settingsInitial = {
    dashboard: {
      giorni_stantio:            Number(allSettings.dashboard.giorni_stantio            ?? SETTING_DEFAULTS.dashboard.giorni_stantio),
      giorni_adempimenti_alert:  Number(allSettings.dashboard.giorni_adempimenti_alert  ?? SETTING_DEFAULTS.dashboard.giorni_adempimenti_alert),
      giorni_manutenzione_alert: Number(allSettings.dashboard.giorni_manutenzione_alert ?? SETTING_DEFAULTS.dashboard.giorni_manutenzione_alert),
      max_items_preview:         Number(allSettings.dashboard.max_items_preview         ?? SETTING_DEFAULTS.dashboard.max_items_preview),
    },
    crm: {
      giorni_followup_default: Number(allSettings.crm.giorni_followup_default ?? SETTING_DEFAULTS.crm.giorni_followup_default),
    },
    studio: {
      nome:     String(allSettings.studio.nome     ?? ''),
      email:    String(allSettings.studio.email    ?? ''),
      telefono: String(allSettings.studio.telefono ?? ''),
    },
    magazzino: {
      giorni_dormiente: Number(allSettings.magazzino.giorni_dormiente ?? SETTING_DEFAULTS.magazzino.giorni_dormiente),
    },
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Settings2 size={22} className="text-gold" />
          Impostazioni
        </h1>
        <p className="text-stone text-sm mt-1">
          Configura i parametri dello studio, KPI e permessi del team.
        </p>
      </div>

      {/* Giorni e orari di apertura */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(160,144,126,0.6)' }}>
          Orari studio
        </h2>
        <ImpostazioniStudio />
      </div>

      {/* KPI e altri parametri */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(160,144,126,0.6)' }}>
          KPI e parametri
        </h2>
        <ImpostazioniAdmin kpi={kpi} currentUserId={user.id} />
      </div>

      {/* Permessi team */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(160,144,126,0.6)' }}>
          Permessi team
        </h2>
        <PermessiAdmin permessi={permessi ?? []} />
      </div>

      {/* ── Settings Operativi v1 ── */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(160,144,126,0.6)' }}>
          Settings Operativi
        </h2>
        <SettingsOperativi initialSettings={settingsInitial} isReadOnly={isReadOnly} />
      </div>
    </div>
  )
}
