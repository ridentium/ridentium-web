import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import RicorrentiStaff from '@/components/Ricorrenti/RicorrentiStaff'

export default async function RicorrentiStaffPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: ricorrenti },
    { data: profilo },
  ] = await Promise.all([
    supabase.from('ricorrenti').select('*').eq('attiva', true).order('created_at', { ascending: true }),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  const nomeCompleto = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

  return (
    <div>
      <PageHeader
        title="Azioni Ricorrenti"
        subtitle="Le tue attività periodiche da completare"
      />
      <RicorrentiStaff
        ricorrenti={(ricorrenti ?? []).map((r: any) => ({
          ...r,
          completamenti: Array.isArray(r.completamenti) ? r.completamenti : [],
        }))}
        currentUserId={user!.id}
        currentUserNome={nomeCompleto}
      />
    </div>
  )
}
