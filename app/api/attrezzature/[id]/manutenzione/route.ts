import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'

// POST /api/attrezzature/[id]/manutenzione — registra intervento
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()

  if (!profilo || profilo.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body mancante' }, { status: 400 })

  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // 1. Inserisci riga manutenzione
  const { data: manut, error: manutError } = await adminDb
    .from('manutenzioni')
    .insert({
      attrezzatura_id: params.id,
      data:            body.data || new Date().toISOString().slice(0, 10),
      tipo:            body.tipo || 'ordinaria',
      eseguito_da:     body.eseguito_da?.trim() || null,
      note:            body.note?.trim() || null,
      prossima_data:   body.prossima_data || null,
      creato_da_nome:  userNome,
    })
    .select()
    .single()

  if (manutError) return NextResponse.json({ error: manutError.message }, { status: 500 })

  // 2. Aggiorna attrezzatura: data_ultima + data_prossima + stato → operativo
  const attrUpdates: Record<string, unknown> = {
    data_ultima_manutenzione:   body.data || new Date().toISOString().slice(0, 10),
    data_prossima_manutenzione: body.prossima_data || null,
    stato:                      'operativo',
    updated_at:                 new Date().toISOString(),
  }

  await adminDb.from('attrezzature').update(attrUpdates).eq('id', params.id)

  // 3. Recupera nome attrezzatura per il log
  const { data: attr } = await adminDb
    .from('attrezzature').select('nome').eq('id', params.id).single()

  await logActivityServer(
    user.id, userNome,
    `Manutenzione registrata: ${attr?.nome ?? params.id}`,
    undefined, 'attrezzature'
  )

  return NextResponse.json({ ok: true, manutenzione: manut, attrUpdates })
}
