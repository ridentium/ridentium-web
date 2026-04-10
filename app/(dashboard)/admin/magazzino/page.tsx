import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoAdmin from '@/components/Magazzino/MagazzinoAdmin'

export default async function MagazzinoPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: items },
    { data: riordini },
    { data: fornitori },
    { data: profilo },
  ] = await Promise.all([
    supabase
      .from('magazzino')
      .select('*')
      .order('categoria')
      .order('diametro', { ascending: true, nullsFirst: false })
      .order('lunghezza', { ascending: true, nullsFirst: false })
      .order('prodotto'),
    supabase
      .from('riordini')
      .select('*, profili(nome, cognome), magazzino(prodotto, categoria)')
      .eq('stato', 'aperta')
      .order('created_at', { ascending: false }),
    supabase
      .from('fornitori')
      .select('*')
      .order('nome'),
    user
      ? supabase.from('profili').select('nome, cognome').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const userId = user?.id
  const userNome = profilo ? `${profilo.nome} ${profilo.cognome}`.trim() : undefined

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
        userId={userId}
        userNome={userNome}
      />
    </div>
  )
}
