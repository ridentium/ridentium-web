import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { updateMagazzinoItemSchema, zodError } from '@/lib/validation'
import { insertMovimento } from '@/lib/magazzino-movimenti'

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

  // Leggi i valori correnti se necessario (quantita o priorita stanno cambiando)
  let quantitaVecchia: number | null = null
  let prioritaVecchia: string | null = null

  if (parsed.data.quantita !== undefined || parsed.data.priorita !== undefined) {
    const { data: current } = await adminDb
      .from('magazzino')
      .select('quantita, priorita')
      .eq('id', params.id)
      .maybeSingle()
    quantitaVecchia = current?.quantita ?? null
    prioritaVecchia = current?.priorita ?? null
  }

  // Componi il payload di aggiornamento
  const updatePayload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  // ultimo_movimento_at si aggiorna SOLO se cambia la quantità
  if (parsed.data.quantita !== undefined) {
    updatePayload.ultimo_movimento_at = new Date().toISOString()
  }

  const { data, error } = await adminDb
    .from('magazzino')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Inserisci movimento se la quantità è cambiata
  if (
    parsed.data.quantita !== undefined &&
    quantitaVecchia !== null &&
    data.quantita !== quantitaVecchia
  ) {
    const delta = data.quantita - quantitaVecchia
    await insertMovimento(adminDb, {
      magazzino_id:   params.id,
      tipo:           delta > 0 ? 'carico_manuale' : 'scarico_manuale',
      quantita_delta: delta,
      quantita_prima: quantitaVecchia,
      quantita_dopo:  data.quantita,
      created_by:     user.id,
    })
  }

  // Log differenziato: quantità vs scheda prodotto vs priorità
  if (parsed.data.quantita !== undefined && Object.keys(parsed.data).length === 1) {
    await logActivityServer(
      user.id, userNome,
      `Quantità aggiornata: ${data.prodotto}`,
      `${data.quantita} ${data.unita ?? 'pz'}`,
      'magazzino'
    )
  } else if (parsed.data.priorita !== undefined && prioritaVecchia !== null && prioritaVecchia !== parsed.data.priorita) {
    // Log dedicato cambio priorità (anche se altri campi sono inclusi)
    await logActivityServer(
      user.id, userNome,
      `Priorità modificata: ${data.prodotto}`,
      `${prioritaVecchia} → ${parsed.data.priorita}`,
      'magazzino'
    )
  } else {
    await logActivityServer(user.id, userNome, 'Prodotto magazzino modificato', data.prodotto, 'magazzino')
  }

  return NextResponse.json({ item: data })
}
