import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import StaffManager from '@/components/Layout/StaffManager'

export default async function StaffPage() {
  const adminDb = createAdminClient()

  const { data: staff } = await adminDb
    .from('profili')
    .select('*')
    .order('ruolo')
    .order('cognome')

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Gestione membri del team"
      />
      <StaffManager staff={staff ?? []} />
    </div>
  )
}
