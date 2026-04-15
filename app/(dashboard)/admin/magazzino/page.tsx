import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoAdmin from '@/components/Magazzino/MagazzinoAdmin'

export default async function MagazzinoPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Tutti i dati in parallelo
  const [{ data: items }, { data: riordini }, { data: fornitori }, { data: profilo }] = await Promise.all([
    supabase
      .from('magazzino')
      .select('*')
      .order('categoria')
      .order('diametro', { ascending: true, nullsFirst: false })
      .order('lunghezza', { ascending: true, nullsFirst: false })
      .order('prodotto'),
    supabase
      .from('riordini')
      .select('*, profili(nome, cognome)')
      .eq('stato', 'aperta')
      .order('created_at', { ascending: false }),
    supabase.from('fornitori').select('*').order('nome'),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  const userNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

  return (
    <div>
      <PageHeader
        title="Magazzino"
        subtitle="Gestione scorte e riordini"
      />
      <MagazzinoAdmin
        items={items ?? []}
        riordini={riordini ?? []}
        fornitori={fornitori ?? []}
        userId={user!.id}
        userNome={userNome}
      />
    </div>
  )
}
