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
    supabase.from('fornitori').select('*').order('nome', { ascending: true }),
    supabase.from('magazzino').select('id, prodotto, azienda, quantita, soglia_minima, unita'),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  return (
    <div>
      <PageHeader
        title="Fornitori & WhatsApp"
        subtitle="Rubrica fornitori e ordini via WhatsApp per prodotti in esaurimento"
      />
      <FornitoriAdmin
        fornitori={fornitori ?? []}
        magazzino={magazzino ?? []}
        currentUserId={user!.id}
        currentUserNome={`${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()}
      />
    </div>
  )
}
