import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import TasksStaff from '@/components/Tasks/TasksStaff'

export default async function StaffTasksPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('assegnato_a', user!.id)
    .order('stato')
    .order('priorita', { ascending: false })
    .order('scadenza', { ascending: true, nullsFirst: false })

  return (
    <div>
      <PageHeader title="I miei task" subtitle="Attività assegnate a te" />
      <TasksStaff tasks={tasks ?? []} userId={user!.id} />
    </div>
  )
}
