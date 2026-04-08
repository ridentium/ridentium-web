import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function DashboardRedirect() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profilo } = await admin
    .from('profili')
    .select('ruolo')
    .eq('id', user!.id)
    .single()

  if (profilo?.ruolo === 'admin') {
    redirect('/admin')
  } else {
    redirect('/staff')
  }
}
