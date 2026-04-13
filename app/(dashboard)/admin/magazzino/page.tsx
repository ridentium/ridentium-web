import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoAdmin from '@/components/Magazzino/MagazzinoAdmin'

export default async function MagazzinoPage() {
  const supabase = createClient()

  // Items + riordini in parallelo (erano sequenziali)
  const [{ data: items }, { data: riordini }] = await Promise.all([
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
  ])

  return (
    <div>
      <PageHeader
        title="Magazzino"
        subtitle="Gestione scorte e riordini"
      />
      <MagazzinoAdmin items={items ?? []} riordini={riordini ?? []} />
    </div>
  )
}
