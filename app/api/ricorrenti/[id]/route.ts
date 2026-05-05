import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { updateRicorrenteSchema, zodError } from '@/lib/validation'

// PATCH /api/ricorrenti/[id] — modifica (solo admin/manager)
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

  // Leggi titolo corrente per il log
  const { data: ricorrenteCorrente } = await adminDb
    .from('ricorrenti').select('titolo').eq('id', params.id).single()

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = updateRicorrenteSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }
  const updates = parsed.data as Record<string, unknown>

  const { data, error } = await adminDb
    .from('ricorrenti').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(
    user.id, userNome,
    'Azione ricorrente aggiornata',
    `"${ricorrenteCorrente?.titolo ?? data.titolo}"`,
    'ricorrenti'
  )

  return NextResponse.json({ ricorrente: data })
}

// DELETE /api/ricorrenti/[id] — elimina (solo admin/manager)
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

  // Leggi titolo prima di eliminare
  const { data: ricorrente } = await adminDb
    .from('ricorrenti').select('titolo').eq('id', params.id).single()

  const { error } = await adminDb
    .from('ricorrenti')
    .update({ attiva: false, deleted_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })

  await logActivityServer(
    user.id, userNome,
    'Azione ricorrente eliminata',
    `"${ricorrente?.titolo ?? params.id}"`,
    'ricorrenti'
  )

  return NextResponse.json({ ok: true })
}
