import { createClient } from '@/lib/supabase/client'

/**
 * Registra un'attività nel log di sistema.
 *
 * @param userId     - ID utente che compie l'azione
 * @param userNome   - Nome visualizzato dell'utente
 * @param azione     - Descrizione breve dell'azione (es. "Ordine ricevuto")
 * @param dettaglio  - Dettaglio opzionale (es. prodotti, quantità)
 * @param categoria  - Categoria: 'todo' | 'magazzino' | 'staff' | 'ricorrenti' | 'sistema' | 'altro'
 */
export async function logActivity(
  userId: string,
  userNome: string,
  azione: string,
  dettaglio?: string | null,
  categoria: 'todo' | 'magazzino' | 'staff' | 'ricorrenti' | 'sistema' | 'altro' = 'altro'
) {
  try {
    const supabase = createClient()
    await supabase.from('registro').insert({
      user_id: userId,
      user_nome: userNome,
      azione,
      dettaglio: dettaglio ?? null,
      categoria,
    })
  } catch {
    // Non bloccare il flusso principale se il log fallisce
  }
}
