import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Layout/Sidebar'
import { UserProfile } from '@/types'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profilo } = await admin
    .from('profili')
    .select('*')
    .eq('id', user!.id)
    .single()

  if (!profilo) redirect('/login')

  if (profilo.ruolo === 'admin') redirect('/admin')

  const { data: alertData } = await admin
    .from('magazzino')
    .select('id, quantita, soglia_minima')

  const alertCount = (alertData ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  ).length

  return (
    <div className="flex min-h-screen">
      <Sidebar profilo={profilo as UserProfile} alertCount={alertCount} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
