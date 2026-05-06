import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { updateContattoSchema, zodError } from '@/lib/validation'

// PATCH /api/fornitori/[id]/contatti/[cid] — aggiorna un contatto (admin/manager)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; cid: string } }
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

  const parsed = updateContattoSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { data, error } = await adminDb
    .from('fornitore_contatti').update(parsed.data).eq('id', params.cid).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se marcato come predefinito, de-seleziona gli altri dello stesso fornitore
  if (parsed.data.is_predefinito) {
    await adminDb
      .from('fornitore_contatti')
      .update({ is_predefinito: false })
      .eq('fornitore_id', params.id)
      .neq('id', params.cid)
  }

  await logActivityServer(user.id, userNome, 'Contatto fornitore modificato', data.nome, 'fornitori')
  return NextResponse.json({ contatto: data })
}

// DELETE /api/fornitori/[id]/contatti/[cid] — elimina un contatto (admin/manager)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; cid: string } }
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

  const { data: contatto } = await adminDb
    .from('fornitore_contatti').select('nome').eq('id', params.cid).single()

  const { error } = await adminDb.from('fornitore_contatti').delete().eq('id', params.cid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(user.id, userNome, 'Contatto fornitore eliminato', contatto?.nome ?? params.cid, 'fornitori')
  return NextResponse.json({ ok: true })
}
