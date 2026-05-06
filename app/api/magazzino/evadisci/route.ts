import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { evadisciRiordineSchema, zodError } from '@/lib/validation'

// POST /api/magazzino/evadisci — segna un riordine come evaso e aggiorna la giacenza (admin/manager)
// Operazione atomica: aggiorna riordini.stato e magazzino.quantita in parallelo.
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

  const parsed = evadisciRiordineSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { riordine_id, magazzino_id, qty_ricevuta } = parsed.data

  // Recupera giacenza corrente
  const { data: itemCorrente } = await adminDb
    .from('magazzino').select('quantita, prodotto, unita').eq('id', magazzino_id).single()
  if (!itemCorrente) {
    return NextResponse.json({ error: 'Prodotto magazzino non trovato' }, { status: 404 })
  }

  const nuovaQty = itemCorrente.quantita + qty_ricevuta

  // Aggiornamento atomico in parallelo
  const [riordineRes, magazzinoRes] = await Promise.all([
    adminDb.from('riordini').update({ stato: 'evasa' }).eq('id', riordine_id),
    adminDb
      .from('magazzino')
      .update({ quantita: nuovaQty, updated_at: new Date().toISOString() })
      .eq('id', magazzino_id)
      .select()
      .single(),
  ])

  if (riordineRes.error) {
    return NextResponse.json({ error: riordineRes.error.message }, { status: 500 })
  }
  if (magazzinoRes.error) {
    return NextResponse.json({ error: magazzinoRes.error.message }, { status: 500 })
  }

  const azione = `Ricevute ${qty_ricevuta} ${itemCorrente.unita ?? 'pz'} → giacenza ${nuovaQty}`
  await logActivityServer(user.id, userNome, `Merce ricevuta: ${itemCorrente.prodotto}`, azione, 'magazzino')

  return NextResponse.json({ ok: true, nuovaQty, item: magazzinoRes.data })
}
