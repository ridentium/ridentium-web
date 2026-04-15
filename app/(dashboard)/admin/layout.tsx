import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/Layout/AdminShell'
import { UserProfile } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const adminDb = createAdminClient()

  // 1. Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Profilo + scorte in parallelo
  const [{ data: profilo }, { data: scoreRaw }] = await Promise.all([
    adminDb.from('profili').select('*').eq('id', user.id).single(),
    supabase.from('magazzino').select('quantita, soglia_minima'),
  ])

  if (profilo?.ruolo !== 'admin') redirect('/staff')

  const alertCount = (scoreRaw ?? []).filter(
    (i: any) => i.quantita < i.soglia_minima
  ).length

  const userName = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

  return (
    <AdminShell
      profilo={profilo as UserProfile}
      alertCount={alertCount}
      userName={userName}
      userRole={profilo?.ruolo ?? 'admin'}
    >
      {children}
    </AdminShell>
  )
}
