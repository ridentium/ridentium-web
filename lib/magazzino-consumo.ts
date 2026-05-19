/**
 * Calcolo consumo medio e copertura scorte per Magazzino Intelligente v2.
 *
 * Il consumo medio si basa esclusivamente sugli SCARICHI (delta < 0)
 * registrati nella tabella magazzino_movimenti negli ultimi N giorni
 * (configurabile via settings: magazzino.giorni_consumo_medio, default 30).
 *
 * I carichi (carico_manuale, ricezione_ordine) non contribuiscono al consumo.
 * Le rettifiche negative (rettifica con delta < 0) vengono incluse.
 * I rollback non vengono inclusi (non registrati per ora, v2.1).
 *
 * Accuratezza: i dati di consumo saranno affidabili solo dopo N giorni
 * di utilizzo (il tracking parte dalla data di deploy del Commit 2).
 */

import type { createAdminClient } from '@/lib/supabase/admin'

export interface ConsumoResult {
  /** Quantità media consumata per giorno negli ultimi giorni_consumo_medio */
  consumoGiornaliero: number | null
  /** Giorni stimati prima di esaurire lo stock attuale */
  giorniCopertura: number | null
  /** Numero di scarichi trovati nel periodo — 0 = nessun consumo registrato */
  scarichiContati: number
  /** Giorni analizzati (dal setting giorni_consumo_medio) */
  giorniAnalizzati: number
}

/**
 * Calcola il consumo medio giornaliero di un prodotto.
 *
 * @param db          - client adminDb (bypassa RLS)
 * @param magazzinoId - UUID del prodotto in magazzino
 * @param quantitaAttuale - giacenza attuale (usata per calcolare la copertura)
 * @param giorniConsumo   - finestra temporale in giorni (es. 30)
 */
export async function calcolaConsumo(
  db: ReturnType<typeof createAdminClient>,
  magazzinoId: string,
  quantitaAttuale: number,
  giorniConsumo: number,
): Promise<ConsumoResult> {
  const cutoff = new Date(Date.now() - giorniConsumo * 86_400_000).toISOString()

  // Scarichi = movimenti con delta negativo nel periodo (solo carico_manuale non incluso)
  // tipo IN scarico_manuale, rettifica (con delta < 0)
  // NON includiamo carico_manuale, ricezione_ordine, rollback
  const { data, error } = await db
    .from('magazzino_movimenti')
    .select('quantita_delta')
    .eq('magazzino_id', magazzinoId)
    .in('tipo', ['scarico_manuale', 'rettifica'])
    .lt('quantita_delta', 0)
    .gte('created_at', cutoff)

  if (error || !data) {
    return { consumoGiornaliero: null, giorniCopertura: null, scarichiContati: 0, giorniAnalizzati: giorniConsumo }
  }

  const scarichiContati = data.length

  if (scarichiContati === 0) {
    return { consumoGiornaliero: null, giorniCopertura: null, scarichiContati: 0, giorniAnalizzati: giorniConsumo }
  }

  // Somma assoluta degli scarichi nel periodo
  const totaleConsumato = data.reduce((acc, row) => acc + Math.abs(row.quantita_delta), 0)

  // Consumo medio giornaliero
  const consumoGiornaliero = totaleConsumato / giorniConsumo

  // Giorni di copertura (arrotondati per difetto, floor)
  const giorniCopertura =
    consumoGiornaliero > 0
      ? Math.floor(quantitaAttuale / consumoGiornaliero)
      : null

  return { consumoGiornaliero, giorniCopertura, scarichiContati, giorniAnalizzati: giorniConsumo }
}

/**
 * Versione batch: calcola il consumo per N prodotti in parallelo.
 * Usato dalla dashboard/live per calcolare finisconoPresto senza N+1 query.
 *
 * Ritorna una Map<magazzino_id, ConsumoResult>.
 */
export async function calcolaConsumoBatch(
  db: ReturnType<typeof createAdminClient>,
  prodotti: Array<{ id: string; quantita: number }>,
  giorniConsumo: number,
): Promise<Map<string, ConsumoResult>> {
  if (prodotti.length === 0) return new Map()

  const cutoff = new Date(Date.now() - giorniConsumo * 86_400_000).toISOString()
  const ids = prodotti.map(p => p.id)

  // Una sola query per tutti i prodotti richiesti
  const { data, error } = await db
    .from('magazzino_movimenti')
    .select('magazzino_id, quantita_delta')
    .in('magazzino_id', ids)
    .in('tipo', ['scarico_manuale', 'rettifica'])
    .lt('quantita_delta', 0)
    .gte('created_at', cutoff)

  const result = new Map<string, ConsumoResult>()

  // Inizializza tutti come "nessun consumo"
  for (const p of prodotti) {
    result.set(p.id, {
      consumoGiornaliero: null,
      giorniCopertura: null,
      scarichiContati: 0,
      giorniAnalizzati: giorniConsumo,
    })
  }

  if (error || !data || data.length === 0) return result

  // Aggrega per prodotto
  const scarichiPerProdotto = new Map<string, { totale: number; count: number }>()
  for (const row of data) {
    const acc = scarichiPerProdotto.get(row.magazzino_id) ?? { totale: 0, count: 0 }
    acc.totale += Math.abs(row.quantita_delta)
    acc.count  += 1
    scarichiPerProdotto.set(row.magazzino_id, acc)
  }

  // Calcola consumo e copertura per ogni prodotto con scarichi
  for (const p of prodotti) {
    const agg = scarichiPerProdotto.get(p.id)
    if (!agg || agg.count === 0) continue

    const consumoGiornaliero = agg.totale / giorniConsumo
    const giorniCopertura =
      consumoGiornaliero > 0 ? Math.floor(p.quantita / consumoGiornaliero) : null

    result.set(p.id, {
      consumoGiornaliero,
      giorniCopertura,
      scarichiContati: agg.count,
      giorniAnalizzati: giorniConsumo,
    })
  }

  return result
}
