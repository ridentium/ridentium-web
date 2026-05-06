import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateProfiloSchema, zodError } from '@/lib/validation'

// PATCH /api/profilo — aggiorna il profilo dell'utente corrente (nome, cognome, telefono)
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = updateProfiloSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const adminDb = createAdminClient()

  // Tenta aggiornamento con tutti i campi; se fallisce su 'telefono' riprova senza
  const { error } = await adminDb
    .from('profili')
    .update(parsed.data)
    .eq('id', user.id)

  if (error) {
    if (error.message.includes('telefono')) {
      // Fallback: aggiorna solo nome e cognome (colonna telefono non presente)
      const { error: retryError } = await adminDb
        .from('profili')
        .update({ nome: parsed.data.nome, cognome: parsed.data.cognome })
        .eq('id', user.id)
      if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
