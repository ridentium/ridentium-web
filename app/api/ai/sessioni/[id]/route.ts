import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'

// DELETE /api/ai/sessioni/[id] — elimina una sessione AI (solo il proprietario)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth('any')
  if (auth instanceof NextResponse) return auth
  const { userId, adminDb } = auth

  // Verifica che la sessione appartenga all'utente corrente
  const { data: sessione } = await adminDb
    .from('ai_sessioni').select('user_id').eq('id', params.id).single()
  if (!sessione || sessione.user_id !== userId) {
    return NextResponse.json({ error: 'Sessione non trovata o non autorizzato' }, { status: 404 })
  }

  const { error } = await adminDb.from('ai_sessioni').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
