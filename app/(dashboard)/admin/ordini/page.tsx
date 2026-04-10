export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import OrdiniAdmin from '@/components/Ordini/OrdiniAdmin'

export default async function OrdiniPage() {
  const supabase  = createClient()
  const adminDb   = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: ordini },
    { data: profilo },
    { data: fornitori },
  ] = await Promise.all([
    adminDb
      .from('ordini')
      .select('*, righe:ordini_righe(*)')
      .order('created_at', { ascending: false }),
    adminDb
      .from('profili')
      .select('nome')
      .eq('id', user!.id)
      .single(),
    adminDb
      .from('fornitori')
      .select('*')
      .order('nome'),
  ])

  return (
    <div>
      <PageHeader
        title="Ordini"
        subtitle="Storico ordini ai fornitori"
      />
      <OrdiniAdmin
        ordini={ordini ?? []}
        userId={user!.id}
        userNome={profilo?.nome ?? ''}
        fornitori={fornitori ?? []}
      />
    </div>
  )
}
