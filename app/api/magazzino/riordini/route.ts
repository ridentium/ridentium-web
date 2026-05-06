import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRiordineSchema, zodError } from '@/lib/validation'
import { logActivityServer } from '@/lib/registro-server'

// POST /api/magazzino/riordini — invia una richiesta di riordino (tutti gli utenti autenticati)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = createRiordineSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const adminDb = createAdminClient()

  // Recupera nome utente e nome prodotto per un log leggibile
  const [{ data: profilo }, { data: prodotto }] = await Promise.all([
    adminDb.from('profili').select('nome, cognome').eq('id', user.id).single(),
    adminDb.from('magazzino').select('prodotto').eq('id', parsed.data.magazzino_id).single(),
  ])
  const userNome = profilo ? `${profilo.nome} ${profilo.cognome}`.trim() : user.id

  const { data, error } = await adminDb
    .from('riordini')
    .insert({ ...parsed.data, richiesto_da: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(
    user.id, userNome,
    'Riordino richiesto',
    prodotto?.prodotto ? `"${prodotto.prodotto}"` : `magazzino_id: ${parsed.data.magazzino_id}`,
    'magazzino'
  )

  return NextResponse.json({ riordine: data }, { status: 201 })
}
