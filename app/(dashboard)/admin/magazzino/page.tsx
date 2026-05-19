import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import MagazzinoAdmin from '@/components/Magazzino/MagazzinoAdmin'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { getSetting, SETTING_DEFAULTS } from '@/lib/settings'
import { calcolaConsumoBatch } from '@/lib/magazzino-consumo'

export default async function MagazzinoPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const M = SETTING_DEFAULTS.magazzino

  // Tutti i dati in parallelo (inclusi settings magazzino v2)
  const [
    { data: items },
    { data: riordini },
    { data: fornitori },
    { data: ordiniRighe },
    giorniDormiente,
    giorniScadenzaCritica,
    giorniScadenzaAttenzione,
    giorniCopertura,
    giorniConsumo,
  ] = await Promise.all([
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
    getSetting<number>('magazzino', 'giorni_dormiente',           M.giorni_dormiente           as number),
    getSetting<number>('magazzino', 'giorni_scadenza_critica',    M.giorni_scadenza_critica    as number),
    getSetting<number>('magazzino', 'giorni_scadenza_attenzione', M.giorni_scadenza_attenzione as number),
    getSetting<number>('magazzino', 'giorni_copertura_alert',     M.giorni_copertura_alert     as number),
    getSetting<number>('magazzino', 'giorni_consumo_medio',       M.giorni_consumo_medio       as number),
  ])

  // Estrai gli ID magazzino già ordinati
  const orderedItemIds = (ordiniRighe ?? [])
    .map((r: any) => r.magazzino_id as string)
    .filter(Boolean)

  // Calcolo consumo batch — una sola query per tutti i prodotti
  const consumoMap = await calcolaConsumoBatch(
    adminDb,
    (items ?? []).map(i => ({ id: i.id, quantita: i.quantita })),
    giorniConsumo,
  )

  // Serializza la Map in un plain object (props React devono essere serializzabili)
  const consumoData: Record<string, { consumoGiornaliero: number | null; giorniCopertura: number | null }> = {}
  consumoMap.forEach((val, id) => {
    consumoData[id] = { consumoGiornaliero: val.consumoGiornaliero, giorniCopertura: val.giorniCopertura }
  })

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
          giorniDormiente={giorniDormiente}
          giorniScadenzaCritica={giorniScadenzaCritica}
          giorniScadenzaAttenzione={giorniScadenzaAttenzione}
          giorniCopertura={giorniCopertura}
          giorniConsumo={giorniConsumo}
          consumoData={consumoData}
        />
      </ErrorBoundary>
    </div>
  )
}
