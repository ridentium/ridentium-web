import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Layout/Sidebar'
import { UserProfile } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Usa admin client per bypassare RLS sulla lettura del profilo
  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profilo?.ruolo !== 'admin') redirect('/staff')

  // Conta prodotti dove quantita < soglia_minima
  const { data: alertData } = await supabase
    .from('magazzino')
    .select('id, quantita, soglia_minima')

  const alertCount = (alertData ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  ).length

  // Conta ordini aperti (inviato o parziale)
  const { data: ordiniApertiData } = await adminDb
    .from('ordini')
    .select('id, stato')
    .in('stato', ['inviato', 'parziale'])

  const ordiniAperti = ordiniApertiData?.length ?? 0

  return (
    <div className="flex min-h-screen">
      <Sidebar profilo={profilo as UserProfile} alertCount={alertCount} ordiniAperti={ordiniAperti} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
