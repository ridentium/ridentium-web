import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoAdmin from '@/components/Magazzino/MagazzinoAdmin'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

export default async function MagazzinoPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Tutti i dati in parallelo
  const [{ data: items }, { data: riordini }, { data: fornitori }, { data: profilo }, { data: ordiniRighe }] = await Promise.all([
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
    supabase.from('fornitori').select('*, fornitore_contatti(*)').order('nome'),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
    // Item magazzino già presenti in ordini aperti (inviato o parziale)
    adminDb
      .from('ordini_righe')
      .select('magazzino_id, ordini!inner(stato)')
      .in('ordini.stato' as any, ['inviato', 'parziale'])
      .not('magazzino_id', 'is', null),
  ])

  // Estrai gli ID magazzino già ordinati
  const orderedItemIds = (ordiniRighe ?? [])
    .map((r: any) => r.magazzino_id as string)
    .filter(Boolean)

  const userNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

  return (
    <div>
      <PageHeader
        title="Magazzino"
        subtitle="Gestione scorte e riordini"
      />
      <ErrorBoundary fallback="Errore nel caricamento del magazzino">
        <MagazzinoAdmin
          items={items ?? []}
          riordini={riordini ?? []}
          fornitori={fornitori ?? []}
          userId={user!.id}
          userNome={userNome}
          orderedItemIds={orderedItemIds}
        />
      </ErrorBoundary>
    </div>
  )
}
