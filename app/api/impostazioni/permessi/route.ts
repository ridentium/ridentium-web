import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertPermessoSchema, zodError } from '@/lib/validation'

// PATCH /api/impostazioni/permessi — aggiorna visibilità sezione per un ruolo (solo admin)
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || profilo.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo admin può modificare i permessi' }, { status: 403 })
  }

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = upsertPermessoSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { error } = await adminDb
    .from('sezione_permessi')
    .upsert(parsed.data, { onConflict: 'sezione,ruolo' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
