import { createClient } from '@/lib/supabase/client'

/**
 * Registra un'attività nel log di sistema.
 *
 * @param userId     - ID utente che compie l'azione
 * @param userNome   - Nome visualizzato dell'utente
 * @param azione     - Descrizione breve dell'azione (es. "Ordine ricevuto")
 * @param dettaglio  - Dettaglio opzionale (es. prodotti, quantità)
 * @param categoria  - Categoria: 'todo' | 'magazzino' | 'ordini' | 'fornitori' | 'crm' | 'staff' | 'ricorrenti' | 'sistema' | 'altro'
 */
export async function logActivity(
  userId: string,
  userNome: string,
  azione: string,
  dettaglio?: string | null,
  categoria: 'todo' | 'magazzino' | 'ordini' | 'fornitori' | 'staff' | 'ricorrenti' | 'crm' | 'sistema' | 'altro' = 'altro'
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('registro_attivita').insert({
      user_id: userId,
      user_nome: userNome,
      azione,
      dettaglio: dettaglio ?? null,
      categoria,
    })
    if (error) {
      console.error('[logActivity] insert failed:', error.message, '| categoria:', categoria, '| azione:', azione)
    }
  } catch (err) {
    // Non bloccare il flusso principale se il log fallisce
    console.error('[logActivity] unexpected error:', err)
  }
}
