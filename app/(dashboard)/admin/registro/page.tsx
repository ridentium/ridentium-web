import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import RegistroAdmin from 'A/components/Registro/RegistroAdmin'

export default async function RegistroAdminPage() {
  const supabase = createClient()

  const { data: entries } = await supabase
    .from('registro_attivita')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div>
      <PageHeader
        title="Registro Attività"
        subtitle="Log completo di tutte le operazioni del team"
      />
      <RegistroAdmin entries={entries ?? []} />
    </div>
  )
}
