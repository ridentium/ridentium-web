import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Redirect automatico in base al ruolo
export default async function DashboardRedirect() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profilo } = await supabase
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profilo?.ruolo === 'admin') {
    redirect('/admin')
  } else {
    redirect('/staff')
  }
}
