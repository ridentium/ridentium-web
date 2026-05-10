import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { requireAuth } from '@/lib/auth-helpers'
import { updateFornitoreSchema, zodError } from '@/lib/validation'

// GET /api/fornitori/[id] — dettaglio fornitore (tutti i ruoli autenticati, sola lettura)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth('any')
  if (auth instanceof NextResponse) return auth

  const { adminDb } = auth
  const { data, error } = await adminDb
    .from('fornitori')
    .select('id, nome, note, created_at')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  return NextResponse.json({ fornitore: data })
}

// PATCH /api/fornitori/[id] — aggiorna nome/note fornitore (admin/manager)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = updateFornitoreSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { data, error } = await adminDb
    .from('fornitori').update(parsed.data).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(user.id, userNome, 'Fornitore modificato', data.nome, 'fornitori')
  return NextResponse.json({ fornitore: data })
}

// DELETE /api/fornitori/[id] — elimina fornitore (admin/manager)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  const { data: fornitore } = await adminDb
    .from('fornitori').select('nome').eq('id', params.id).single()

  const { error } = await adminDb.from('fornitori').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(user.id, userNome, 'Fornitore eliminato', fornitore?.nome ?? params.id, 'fornitori')
  return NextResponse.json({ ok: true })
}
