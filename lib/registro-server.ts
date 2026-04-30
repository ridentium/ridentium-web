/**
 * Versione server-side di logActivity — usa adminClient invece del browser client.
 * Da usare nelle API routes (non nei componenti client).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { CategoriaRegistro } from '@/types'

export async function logActivityServer(
  userId: string,
  userNome: string,
  azione: string,
  dettaglio?: string | null,
  categoria: CategoriaRegistro = 'altro'
) {
  try {
    const adminDb = createAdminClient()
    await adminDb.from('registro_attivita').insert({
      user_id: userId,
      user_nome: userNome,
      azione,
      dettaglio: dettaglio ?? null,
      categoria,
    })
  } catch (err) {
    // Non blocca mai il flusso principale
    console.error('[logActivityServer]', err)
  }
}
