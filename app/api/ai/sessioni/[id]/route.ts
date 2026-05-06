import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/ai/sessioni/[id] — elimina una sessione AI (solo il proprietario)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()

  // Verifica che la sessione appartenga all'utente corrente
  const { data: sessione } = await adminDb
    .from('ai_sessioni').select('user_id').eq('id', params.id).single()
  if (!sessione || sessione.user_id !== user.id) {
    return NextResponse.json({ error: 'Sessione non trovata o non autorizzato' }, { status: 404 })
  }

  const { error } = await adminDb.from('ai_sessioni').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
