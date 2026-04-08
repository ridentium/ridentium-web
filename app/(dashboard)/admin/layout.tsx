import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Layout/Sidebar'
import { UserProfile } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profilo } = await supabase
    .from('profili')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profilo?.ruolo !== 'admin') redirect('/staff')

  // Conta prodotti dove quantita < soglia_minima usando una view lato server
  const { data: alertData } = await supabase
    .from('magazzino')
    .select('id, quantita, soglia_minima')

  const alertCount = (alertData ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
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
