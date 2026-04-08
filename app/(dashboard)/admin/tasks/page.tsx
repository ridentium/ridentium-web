import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import TasksAdmin from '@/components/Tasks/TasksAdmin'

export default async function TasksAdminPage() {
  const supabase = createClient()

  const [{ data: tasks }, { data: staff }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, assegnato_a_profilo:profili!tasks_assegnato_a_fkey(nome, cognome, ruolo)')
      .order('priorita', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('profili').select('id, nome, cognome, ruolo').eq('attivo', true),
  ])

  return (
    <div>
      <PageHeader title="Task" subtitle="Gestione attività e assegnazioni" />
      <TasksAdmin tasks={tasks ?? []} staff={staff ?? []} />
    </div>
  )
}
