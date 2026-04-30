import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import TasksStaff from '@/components/Tasks/TasksStaff'

export default async function StaffTasksPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tasks }, { data: profilo }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('assegnato_a', user!.id)
      .is('deleted_at', null)
      .order('stato')
      .order('priorita', { ascending: false })
      .order('scadenza', { ascending: true, nullsFirst: false }),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  const userNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

  return (
    <div>
      <PageHeader title="I miei task" subtitle="Attività assegnate a te" />
      <TasksStaff tasks={tasks ?? []} userId={user!.id} userNome={userNome} />
    </div>
  )
}
