import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const { fornitore_id, fornitore_nome, canale, note, righe } = await req.json()

  if (!fornitore_nome || !righe?.length) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const { data: ordine, error: errOrdine } = await adminDb
    .from('ordini')
    .insert({
      fornitore_id: fornitore_id || null,
      fornitore_nome,
      canale: canale ?? 'whatsapp',
      stato: 'inviato',
      note: note || null,
      data_invio: new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single()

  if (errOrdine || !ordine) {
    return NextResponse.json({ error: errOrdine?.message ?? 'Errore creazione ordine' }, { status: 500 })
  }

  const righeInsert = righe.map((r: {
    magazzino_id?: string | null
    prodotto_nome: string
    quantita_ordinata: number
    unita?: string | null
  }) => ({
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
    await adminDb.from('ordini').delete().eq('id', ordine.id)
    return NextResponse.json({ error: errRighe.message }, { status: 500 })
  }

  return NextResponse.json({ ordine: { ...ordine, righe: righeData ?? [] } })
}
