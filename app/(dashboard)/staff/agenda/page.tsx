import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import AgendaView from '@/components/Agenda/AgendaView'

export default async function AgendaStaffPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      <PageHeader
        title="La mia Agenda"
        subtitle="I tuoi task, ricorrenti e adempimenti"
      />
      <AgendaView
        isAdmin={false}
        userId={user!.id}
      />
    </div>
  )
}
