/**
 * Helper per inserire movimenti nella tabella magazzino_movimenti.
 *
 * Chiamato da:
 *  - PATCH /api/magazzino/[id]    → carico_manuale / scarico_manuale
 *  - POST  /api/magazzino         → carico_manuale (stock iniziale)
 *  - POST  /api/magazzino/evadisci → ricezione_ordine
 *
 * NON aggiornato da: RPC ripristina_ricezione_tx (rollback ordine).
 * Limite noto: il rollback ordine non genera un movimento 'rollback'.
 * Fix pianificato in v2.1 — la RPC andrebbe estesa con un INSERT atomico
 * oppure sostituita con logica applicativa lato API.
 */

import type { createAdminClient } from '@/lib/supabase/admin'

export type TipoMovimento =
  | 'carico_manuale'
  | 'scarico_manuale'
  | 'ricezione_ordine'
  | 'rettifica'
  | 'rollback'

interface MovimentoPayload {
  magazzino_id:    string
  tipo:            TipoMovimento
  quantita_delta:  number         // positivo = carico, negativo = scarico
  quantita_prima?: number | null
  quantita_dopo:   number
  note?:           string | null
  created_by?:     string | null
}

/**
 * Inserisce un singolo movimento nella tabella magazzino_movimenti.
 *
 * Non lancia eccezioni (fire-and-forget consapevole):
 * un eventuale errore DB non deve bloccare la response principale.
 */
export async function insertMovimento(
  db: ReturnType<typeof createAdminClient>,
  payload: MovimentoPayload,
): Promise<void> {
  const { error } = await db.from('magazzino_movimenti').insert({
    magazzino_id:   payload.magazzino_id,
    tipo:           payload.tipo,
    quantita_delta: payload.quantita_delta,
    quantita_prima: payload.quantita_prima ?? null,
    quantita_dopo:  payload.quantita_dopo,
    note:           payload.note ?? null,
    created_by:     payload.created_by ?? null,
  })
  if (error) {
    // Log ma non rilanciare — la response principale non dipende da questo
    console.error('[insertMovimento] errore inserimento movimento:', error.message)
  }
}
