import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { createRicorrenteSchema, zodError } from '@/lib/validation'

// POST /api/ricorrenti — crea una nuova azione ricorrente (solo admin/manager)
export async function POST(req: NextRequest) {
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

  const parsed = createRicorrenteSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }
  const { titolo, descrizione, frequenza, assegnato_a } = parsed.data

  const { data, error } = await adminDb
    .from('ricorrenti')
    .insert({
      titolo,
      descrizione: descrizione ?? null,
      frequenza,
      assegnato_a: assegnato_a ?? null,
      attiva: true,
      completamenti: [],
    })
    .select()
    .single()

  if (error) {
    console.error('[ricorrenti POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivityServer(
    user.id, userNome,
    'Azione ricorrente creata',
    `"${titolo}" — ${frequenza}`,
    'ricorrenti'
  )

  return NextResponse.json({ ricorrente: data }, { status: 201 })
}
