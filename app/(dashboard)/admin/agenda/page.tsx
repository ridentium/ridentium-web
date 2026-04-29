import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import AgendaView from '@/components/Agenda/AgendaView'

export default async function AgendaAdminPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('id, ruolo')
    .eq('id', user!.id)
    .single()

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Tutto in un'unica vista — task, ricorrenti e adempimenti"
      />
      <AgendaView
        isAdmin={['admin', 'manager'].includes(profilo?.ruolo ?? '')}
        userId={user!.id}
      />
    </div>
  )
}
