import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import ImpostazioniAdmin from '@/components/Impostazioni/ImpostazioniAdmin'
import PermessiAdmin from '@/components/Impostazioni/PermessiAdmin'

export default async function ImpostazioniAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
    <div>
      <PageHeader
        title="Impostazioni"
        subtitle="Configura KPI, parametri e permessi dello studio"
      />
      <ImpostazioniAdmin
        kpi={kpi}
        currentUserId={user!.id}
      />
      <PermessiAdmin permessi={permessi ?? []} />
    </div>
  )
}
