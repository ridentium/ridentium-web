import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/Layout/AdminShell'
import { UserProfile } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Dati paralleli per layout + contesto Lina
  const [{ data: profilo }, { data: scoreRaw }, { data: tasksRaw }] = await Promise.all([
    adminDb.from('profili').select('*').eq('id', user.id).single(),
    supabase.from('magazzino').select('quantita, soglia_minima'),
    supabase.from('tasks').select('id').neq('stato', 'completato').is('deleted_at', null),
  ])

  if (profilo?.ruolo !== 'admin') redirect('/staff')

  const alertCount = (scoreRaw ?? []).filter(
    (i: any) => i.quantita < i.soglia_minima
  ).length

  const tasksCount = tasksRaw?.length ?? 0
  const userName = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

  return (
    <AdminShell
      profilo={profilo as UserProfile}
      alertCount={alertCount}
      tasksCount={tasksCount}
      userName={userName}
      userRole={profilo?.ruolo ?? 'admin'}
    >
      {children}
    </AdminShell>
  )
}
