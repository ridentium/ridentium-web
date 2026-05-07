import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/Layout/AdminShell'
import { UserProfile } from '@/types'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profilo } = await admin
    .from('profili')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profilo) redirect('/login')
  if (profilo.ruolo === 'admin') redirect('/admin')

  const [{ data: alertData }, { data: tasksData }] = await Promise.all([
    supabase.from('magazzino').select('id, quantita, soglia_minima'),
    supabase.from('tasks').select('id')
      .eq('assegnato_a', user.id)
      .neq('stato', 'completato')
      .is('deleted_at', null),
  ])

  const alertCount = (alertData ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  ).length

  const tasksCount = tasksData?.length ?? 0
  const userName = `${profilo.nome ?? ''} ${profilo.cognome ?? ''}`.trim()

  return (
    <AdminShell
      profilo={profilo as UserProfile}
      alertCount={alertCount}
      tasksCount={tasksCount}
      userName={userName}
      userRole={profilo.ruolo}
    >
      {children}
    </AdminShell>
  )
}
