import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import FornitoriAdmin from '@/components/Fornitori/FornitoriAdmin'

export default async function FornitoriAdminPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: fornitori },
    { data: magazzino },
    { data: profilo },
  ] = await Promise.all([
    // JOIN con i contatti per ogni fornitore
    supabase
      .from('fornitori')
      .select('*, fornitore_contatti(*)')
      .order('nome', { ascending: true }),
    supabase.from('magazzino').select('id, prodotto, azienda, quantita, soglia_minima, unita'),
    adminDb.from('profili').select('nome, cognome, ruolo').eq('id', user!.id).single(),
  ])

  return (
    <div>
      <PageHeader
        title="Fornitori"
        subtitle="Rubrica fornitori, contatti e canali di ordine"
      />
      <FornitoriAdmin
        fornitori={fornitori ?? []}
        magazzino={magazzino ?? []}
        currentUserId={user!.id}
        currentUserNome={`${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()}
        userRole={profilo?.ruolo ?? 'admin'}
      />
    </div>
  )
}
