import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { createMagazzinoItemSchema, zodError } from '@/lib/validation'

// GET /api/magazzino — lista prodotti per dropdown (utenti autenticati)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('magazzino')
    .select('id, prodotto, unita, azienda')
    .order('prodotto', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/magazzino — aggiunge un prodotto al magazzino (admin/manager)
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

  const parsed = createMagazzinoItemSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { data, error } = await adminDb
    .from('magazzino').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivityServer(user.id, userNome, 'Prodotto aggiunto al magazzino', data.prodotto, 'magazzino')
  return NextResponse.json({ item: data }, { status: 201 })
}
