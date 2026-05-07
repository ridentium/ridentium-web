import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { getPeriodoKey } from '@/lib/periodo'

// POST /api/ricorrenti/[id]/completamento
// Toggle completamento in modo atomico tramite RPC Postgres (FOR UPDATE).
// Previene la race condition "last write wins" quando due utenti cliccano
// "Completa" contemporaneamente sullo stesso ricorrente.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('nome, cognome')
    .eq('id', user.id)
    .single()

  if (!profilo) {
    return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // Leggi frequenza per calcolare periodoKey lato server
  const { data: ricorrente } = await adminDb
    .from('ricorrenti')
    .select('id, titolo, frequenza, attiva, deleted_at')
    .eq('id', params.id)
    .single()

  if (!ricorrente || !ricorrente.attiva || ricorrente.deleted_at) {
    return NextResponse.json({ error: 'Azione ricorrente non trovata o inattiva' }, { status: 404 })
  }

  const periodoKey = getPeriodoKey(ricorrente.frequenza)

  // Nota facoltativa dal body (inviata dal widget NotePopup)
  let nota: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.nota === 'string' && body.nota.trim()) {
      nota = body.nota.trim()
    }
  } catch { /* body assente o non-JSON — nessuna nota */ }

  // Chiama la RPC atomica (usa SELECT FOR UPDATE internamente)
  const { data: nuoviCompletamenti, error } = await adminDb.rpc(
    'toggle_completamento_ricorrente',
    {
      p_ricorrente_id: params.id,
      p_user_id:       user.id,
      p_user_name:     userNome,
      p_periodo_key:   periodoKey,
      p_nota:          nota,
    }
  )

  if (error) {
    console.error('[completamento POST] RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Determina se è stata aggiunta o rimossa (per il log)
  const completamenti = Array.isArray(nuoviCompletamenti) ? nuoviCompletamenti : []
  const aggiunto = completamenti.some(
    (c: { userId: string; periodoKey: string }) =>
      c.userId === user.id && c.periodoKey === periodoKey
  )

  await logActivityServer(
    user.id,
    userNome,
    aggiunto ? 'Azione ricorrente completata' : 'Azione ricorrente rimossa',
    `"${ricorrente.titolo}"`,
    'ricorrenti'
  )

  return NextResponse.json({ completamenti, aggiunto })
}
