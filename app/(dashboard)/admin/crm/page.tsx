import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMAdmin from '@/components/CRM/CRMAdmin'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const [contattiRes, profiloRes] = await Promise.all([
    adminSupabase.from('crm_contatti').select('*').order('created_at', { ascending: false }),
    adminSupabase.from('profili').select('ruolo, nome').eq('id', user.id).single(),
  ])

  const profilo = profiloRes.data
  if (!profilo) redirect('/admin')

  const isAdmin = profilo.ruolo === 'admin'

  return (
    <CRMAdmin
      contatti={contattiRes.data ?? []}
      isAdmin={isAdmin}
      userId={user!.id}
      userNome={profilo.nome ?? user!.email ?? ''}
    />
  )
}
