import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMAdmin from '@/components/CRM/CRMAdmin'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [contattiRes, profiloRes] = await Promise.all([
    adminSupabase.from('crm_contatti').select('*').order('created_at', { ascending: false }),
    adminSupabase.from('profili').select('ruolo').eq('id', user.id).single(),
  ])

  const profilo = profiloRes.data
  if (!profilo) redirect('/admin')

  return (
    <CRMAdmin
      contatti={contattiRes.data ?? []}
      isAdmin={profilo.ruolo === 'admin'}
    />
  )
}
