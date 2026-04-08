import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import ImpostazioniAdmin from '@/components/Impostazioni/ImpostazioniAdmin'

export default async function ImpostazioniAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: kpi } = await supabase
    .from('kpi')
    .select('*')
    .single()

  return (
    <div>
      <PageHeader
        title="Impostazioni"
        subtitle="Configura KPI e parametri dello studio"
      />
      <ImpostazioniAdmin
        kpi={kpi}
        currentUserId={user!.id}
      />
    </div>
  )
}
