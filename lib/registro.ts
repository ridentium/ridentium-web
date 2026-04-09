import { createClient } from '@/lib/supabase/client'

export async function logActivity(
  userId: string,
  userNome: string,
  azione: string,
  dettaglio?: string,
  categoria = 'sistema'
) {
  try {
    const supabase = createClient()
    await supabase.from('registro_attivita').insert({
      user_id: userId,
      user_nome: userNome,
      azione,
      dettaglio: dettaglio ?? null,
      categoria,
    })
  } catch {
    // Non bloccare l'UI
  }
}
