import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'

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

  const body = await req.json()
  const allowed = ['titolo', 'descrizione', 'frequenza', 'assegnato_a', 'attiva']
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) updates[k] = body[k]

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

  const { error } = await adminDb.from('ricorrenti').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(
    user.id, userNome,
    'Azione ricorrente eliminata',
    `"${ricorrente?.titolo ?? params.id}"`,
    'ricorrenti'
  )

  return NextResponse.json({ ok: true })
}
