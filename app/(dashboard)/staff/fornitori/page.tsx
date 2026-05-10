import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import FornitoriAdmin from '@/components/Fornitori/FornitoriAdmin'

export default async function FornitoriStaffPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: fornitori },
    { data: profilo },
  ] = await Promise.all([
    adminDb
      .from('fornitori')
      .select('*, fornitore_contatti(*)')
      .order('nome', { ascending: true }),
    adminDb.from('profili').select('nome, cognome, ruolo').eq('id', user!.id).single(),
  ])

  return (
    <div>
      <PageHeader
        title="Fornitori"
        subtitle="Rubrica fornitori e contatti — sola lettura"
        breadcrumb={{ label: 'Home', href: '/staff' }}
      />
      <FornitoriAdmin
        fornitori={fornitori ?? []}
        magazzino={[]}
        currentUserId={user!.id}
        currentUserNome={`${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()}
        userRole={profilo?.ruolo ?? 'staff'}
      />
    </div>
  )
}
