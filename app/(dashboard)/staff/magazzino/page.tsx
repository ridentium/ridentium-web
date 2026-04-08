import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoStaff from '@/components/Magazzino/MagazzinoStaff'

export default async function MagazzinoStaffPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: items } = await supabase
    .from('magazzino')
    .select('*')
    .order('categoria')
    .order('diametro', { ascending: true, nullsFirst: false })
    .order('lunghezza', { ascending: true, nullsFirst: false })
    .order('prodotto')

  const { data: myRiordini } = await supabase
    .from('riordini')
    .select('magazzino_id, stato')
    .eq('richiesto_da', user!.id)
    .eq('stato', 'aperta')

  const riordiniIds = (myRiordini ?? []).map((r: any) => r.magazzino_id)

  return (
    <div>
      <PageHeader
        title="Magazzino"
        subtitle="Consulta lo stock e segnala prodotti da riordinare"
      />
      <MagazzinoStaff items={items ?? []} riordiniAperti={riordiniIds} userId={user!.id} />
    </div>
  )
}
