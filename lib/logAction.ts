import type { SupabaseClient } from '@supabase/supabase-js'

interface LogActionParams {
  supabase: SupabaseClient
  userId: string
  userNome: string
  azione: string
  dettaglio?: string
  categoria: string
  operazione?: 'insert' | 'update' | 'delete' | 'action'
  entitaTipo?: string
  entitaId?: string
  metadata?: Record<string, unknown>
}

/**
 * Write a granular audit log entry to registro_attivita.
 * Best-effort — errors are swallowed so they never break the main flow.
 */
export async function logAction({
  supabase,
  userId,
  userNome,
  azione,
  dettaglio,
  categoria,
  operazione = 'action',
  entitaTipo,
  entitaId,
  metadata,
}: LogActionParams): Promise<void> {
  try {
    await supabase.from('registro_attivita').insert({
      user_id: userId,
      user_nome: userNome,
      azione,
      dettaglio: dettaglio ?? null,
      categoria,
      operazione,
      entita_tipo: entitaTipo ?? null,
      entita_id: entitaId ?? null,
      metadata: metadata ?? null,
    })
  } catch {
    // silent — logging must never crash the app
  }
}
