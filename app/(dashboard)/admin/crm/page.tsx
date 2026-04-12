import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/Layout/PageHeader'
import CRMAdmin from '@/components/CRM/CRMAdmin'
import { CRMContatto } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CRMPage() {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    redirect('/admin')
  }

  const { data: contatti } = await adminDb
    .from('crm_contatti')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="CRM"
        subtitle={`${(contatti ?? []).length} contatt${(contatti ?? []).length === 1 ? 'o' : 'i'} totali`}
      />
      <CRMAdmin
        contatti={(contatti ?? []) as CRMContatto[]}
        isAdmin={profilo.ruolo === 'admin'}
      />
    </div>
  )
}
