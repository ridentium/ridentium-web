import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotifica } from '@/lib/notifiche'
import { logActivityServer } from '@/lib/registro-server'
import { createOrdineSchema, zodError } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = createOrdineSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }
  const { fornitore_id, fornitore_nome, canale, note, righe } = parsed.data

  const { data: ordine, error: errOrdine } = await adminDb
    .from('ordini')
    .insert({
      fornitore_id: fornitore_id ?? null,
      fornitore_nome,
      canale,
      stato: 'inviato',
      note: note ?? null,
      data_invio: new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single()

  if (errOrdine || !ordine) {
    return NextResponse.json({ error: errOrdine?.message ?? 'Errore creazione ordine' }, { status: 500 })
  }

  const righeInsert = righe.map((r) => ({
    ordine_id: ordine.id,
    magazzino_id: r.magazzino_id || null,
    prodotto_nome: r.prodotto_nome,
    quantita_ordinata: r.quantita_ordinata,
    unita: r.unita || null,
  }))

  const { data: righeData, error: errRighe } = await adminDb
    .from('ordini_righe')
    .insert(righeInsert)
    .select()

  if (errRighe) {
    const { error: cleanupErr } = await adminDb.from('ordini').delete().eq('id', ordine.id)
    if (cleanupErr) console.error('[ordini] Cleanup ordine fallito:', cleanupErr.message)
    return NextResponse.json({ error: 'Errore nel salvataggio delle righe ordine' }, { status: 500 })
  }

  // Log attività
  const prodottiOrdinati = righe.map(r => `${r.prodotto_nome}: ${r.quantita_ordinata} ${r.unita ?? 'pz'}`).join(', ')
  await logActivityServer(user.id, userNome, `Nuovo ordine creato: ${fornitore_nome}`, prodottiOrdinati, 'ordini')

  // Notifica push: ordine inviato
  const prodottiStr = righe.slice(0, 3).map(r => r.prodotto_nome).join(', ')
  const extra = righe.length > 3 ? ` +${righe.length - 3} altri` : ''
  try {
    await createNotifica({
      ruoli: ['admin', 'manager'],
      tipo: 'magazzino',
      titolo: `Ordine inviato a ${fornitore_nome}`,
      corpo: `${prodottiStr}${extra} — canale: ${canale ?? 'whatsapp'}`,
      url: '/admin/ordini',
      push: true,
    })
  } catch (e) {
    console.error('[ordini] Notifica failed:', e)
  }

  return NextResponse.json({ ordine: { ...ordine, righe: righeData ?? [] } })
}
