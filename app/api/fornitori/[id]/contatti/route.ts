import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { createContattoSchema, zodError } from '@/lib/validation'

// POST /api/fornitori/[id]/contatti — aggiunge un contatto al fornitore (admin/manager)
export async function POST(
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

  const parsed = createContattoSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const payload = { ...parsed.data, fornitore_id: params.id }

  const { data, error } = await adminDb
    .from('fornitore_contatti').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se marcato come predefinito, de-seleziona gli altri dello stesso fornitore
  if (payload.is_predefinito) {
    await adminDb
      .from('fornitore_contatti')
      .update({ is_predefinito: false })
      .eq('fornitore_id', params.id)
      .neq('id', data.id)
  }

  await logActivityServer(user.id, userNome, 'Contatto fornitore aggiunto', data.nome, 'fornitori')
  return NextResponse.json({ contatto: data }, { status: 201 })
}
