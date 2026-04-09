import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Layout/Sidebar'
import { UserProfile } from '@/types'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Usa admin client per bypassare RLS sulla lettura del profilo
  const admin = createAdminClient()
  const { data: profilo } = await admin
    .from('profili')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profilo) redirect('/login')

  // Admin non deve stare qui
  if (profilo.ruolo === 'admin') redirect('/admin')

  // Conta alert magazzino per lo staff
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
        {/* Mobile top bar spacer */}
        <div className="md:hidden h-14 border-b border-obsidian-light/50 flex items-center px-14 bg-obsidian/95 sticky top-0 z-30">
          <h2 className="font-serif text-cream tracking-[0.2em] text-sm font-light">RIDENTIUM</h2>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
