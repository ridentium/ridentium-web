import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Layout/Sidebar'
import SessionGuard from '@/components/Layout/SessionGuard'
import { UserProfile } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profilo?.ruolo !== 'admin') redirect('/staff')

  const { data: alertData } = await supabase
    .from('magazzino')
    .select('id, quantita, soglia_minima')
  const alertCount = (alertData ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  ).length

  const { data: ordiniApertiData } = await adminDb
    .from('ordini')
    .select('id, stato')
    .in('stato', ['inviato', 'parziale'])
  const ordiniAperti = ordiniApertiData?.length ?? 0

  return (
    <div className="flex min-h-screen">
      <SessionGuard />
      <Sidebar
        profilo={profilo as UserProfile}
        alertCount={alertCount}
        ordiniAperti={ordiniAperti}
      />
      <main className="flex-1 overflow-auto">
        <div className="md:hidden h-14 border-b border-obsidian-light/50 flex items-center px-14 bg-obsidian/95 sticky top-0 z-30">
          <h2 className="font-serif text-cream tracking-[0.2em] text-sm font-light">RIDENTIUM</h2>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
