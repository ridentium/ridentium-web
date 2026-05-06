export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import OrdiniAdmin from '@/components/Ordini/OrdiniAdmin'

export default async function OrdiniPage() {
  const adminDb = createAdminClient()

  const [
    { data: ordini },
    { data: fornitori },
  ] = await Promise.all([
    adminDb
      .from('ordini')
      .select('*, righe:ordini_righe(*)')
      .order('created_at', { ascending: false }),
    adminDb
      .from('fornitori')
      .select('*'),
  ])

  return (
    <div>
      <PageHeader
        title="Ordini"
        subtitle="Storico ordini ai fornitori"
      />
      <OrdiniAdmin
        ordini={ordini ?? []}
        fornitori={fornitori ?? []}
      />
    </div>
  )
}
