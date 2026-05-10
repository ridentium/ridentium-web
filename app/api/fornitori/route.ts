import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { requireAuth } from '@/lib/auth-helpers'
import { createFornitoreSchema, zodError } from '@/lib/validation'

// GET /api/fornitori — lista fornitori (tutti i ruoli autenticati, sola lettura)
export async function GET() {
  const auth = await requireAuth('any')
  if (auth instanceof NextResponse) return auth

  const { adminDb } = auth
  const { data, error } = await adminDb
    .from('fornitori')
    .select('id, nome, note, created_at')
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: 'Errore nel recupero fornitori' }, { status: 500 })
  return NextResponse.json({ fornitori: data })
}

// POST /api/fornitori — crea un nuovo fornitore (admin/manager)
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

  const parsed = createFornitoreSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { data, error } = await adminDb
    .from('fornitori').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(user.id, userNome, 'Fornitore aggiunto', data.nome, 'fornitori')
  return NextResponse.json({ fornitore: data }, { status: 201 })
}
