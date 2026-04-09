import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/Layout/PageHeader'
import ProfiloPagina from '@/components/Profilo/ProfiloPagina'
import { UserProfile } from '@/types'

export default async function StaffProfiloPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profilo) redirect('/staff')

  return (
    <div>
      <PageHeader
        title="Il mio Profilo"
        subtitle="Gestisci i tuoi dati personali e le impostazioni account"
      />
      <ProfiloPagina profilo={profilo as UserProfile} />
    </div>
  )
}
