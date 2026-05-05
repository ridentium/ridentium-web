import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import RicorrentiAdmin from '@/components/Ricorrenti/RicorrentiAdmin'

export default async function RicorrentiAdminPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: ricorrenti },
    { data: staff },
    { data: profilo },
  ] = await Promise.all([
    supabase.from('ricorrenti').select('*').is('deleted_at', null).order('created_at', { ascending: true }),
    adminDb.from('profili').select('id, email, nome, cognome, ruolo, created_at').eq('attivo', true).neq('ruolo', 'admin'),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  return (
    <div>
      <PageHeader
        title="Azioni Ricorrenti"
        subtitle="Attività periodiche da completare dal team"
      />
      <RicorrentiAdmin
        ricorrenti={(ricorrenti ?? []).map((r: any) => ({
          ...r,
          completamenti: Array.isArray(r.completamenti) ? r.completamenti : [],
        }))}
        staff={staff ?? []}
        currentUserId={user!.id}
        currentUserNome={`${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()}
      />
    </div>
  )
}
