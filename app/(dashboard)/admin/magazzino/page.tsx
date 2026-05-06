import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoAdmin from '@/components/Magazzino/MagazzinoAdmin'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

export default async function MagazzinoPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()

  // Tutti i dati in parallelo
  const [{ data: items }, { data: riordini }, { data: fornitori }, { data: ordiniRighe }] = await Promise.all([
    supabase
      .from('magazzino')
      .select('*')
      .order('categoria')
      .order('diametro', { ascending: true, nullsFirst: false })
      .order('lunghezza', { ascending: true, nullsFirst: false })
      .order('prodotto')
      .limit(500),
    supabase
      .from('riordini')
      .select('*, profili(nome, cognome)')
      .eq('stato', 'aperta')
      .order('created_at', { ascending: false }),
    supabase.from('fornitori').select('*, fornitore_contatti(*)').order('nome'),
    // Item magazzino già presenti in ordini aperti (inviato o parziale)
    adminDb
      .from('ordini_righe')
      .select('magazzino_id, ordini!inner(stato)')
      .in('ordini.stato', ['inviato', 'parziale'])
      .not('magazzino_id', 'is', null),
  ])

  // Estrai gli ID magazzino già ordinati
  const orderedItemIds = (ordiniRighe ?? [])
    .map((r: any) => r.magazzino_id as string)
    .filter(Boolean)

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
          orderedItemIds={orderedItemIds}
        />
      </ErrorBoundary>
    </div>
  )
}
