import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Settings2 } from 'lucide-react'
import PageHeader from '@/components/Layout/PageHeader'
import ImpostazioniAdmin from '@/components/Impostazioni/ImpostazioniAdmin'
import PermessiAdmin from '@/components/Impostazioni/PermessiAdmin'
import ImpostazioniStudio from '@/components/Impostazioni/ImpostazioniStudio'

export default async function ImpostazioniAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()

  const { data: kpi } = await supabase
    .from('kpi')
    .select('*')
    .single()

  const { data: permessi } = await adminDb
    .from('sezione_permessi')
    .select('sezione, ruolo, visibile')
    .order('sezione')

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
    </div>
  )
}
