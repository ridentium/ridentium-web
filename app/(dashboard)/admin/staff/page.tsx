import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import StaffManager from '@/components/Layout/StaffManager'

export default async function StaffPage() {
  const supabase = createClient()
  const { data: staff } = await supabase
    .from('profili')
    .select('*')
    .order('ruolo')
    .order('cognome')

  return (
    <div>
      <PageHeader title="Staff" subtitle="Gestione membri del team" />
      <StaffManager staff={staff ?? []} />
    </div>
  )
}
