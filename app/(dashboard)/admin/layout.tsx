import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Layout/Sidebar'
import { UserProfile } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const adminDb = createAdminClient()

  // 1. Auth — deve precedere le altre query (serve user.id)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Profilo + scorte in parallelo: erano 2 query sequenziali (~300ms risparmiati per ogni navigazione)
  const [{ data: profilo }, { data: scoreRaw }] = await Promise.all([
    adminDb.from('profili').select('*').eq('id', user.id).single(),
    supabase.from('magazzino').select('quantita, soglia_minima'),
  ])

  if (profilo?.ruolo !== 'admin') redirect('/staff')

  const alertCount = (scoreRaw ?? []).filter(
    (i: any) => i.quantita < i.soglia_minima
  ).length

  return (
    <div className="flex min-h-screen">
      <Sidebar profilo={profilo as UserProfile} alertCount={alertCount} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
