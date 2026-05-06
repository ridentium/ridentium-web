import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { updateMagazzinoItemSchema, zodError } from '@/lib/validation'

// PATCH /api/magazzino/[id] — aggiorna un prodotto (o solo la quantità) (admin/manager)
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

  const parsed = updateMagazzinoItemSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { data, error } = await adminDb
    .from('magazzino')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log differenziato: aggiornamento quantità vs modifica scheda prodotto
  if (parsed.data.quantita !== undefined && Object.keys(parsed.data).length === 1) {
    await logActivityServer(
      user.id, userNome,
      `Quantità aggiornata: ${data.prodotto}`,
      `${data.quantita} ${data.unita ?? 'pz'}`,
      'magazzino'
    )
  } else {
    await logActivityServer(user.id, userNome, 'Prodotto magazzino modificato', data.prodotto, 'magazzino')
  }

  return NextResponse.json({ item: data })
}
