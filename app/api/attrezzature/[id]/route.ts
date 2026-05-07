import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'

// PATCH /api/attrezzature/[id] — aggiorna stato, note, prossima manutenzione
export async function PATCH(
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

  const body = await req.json().catch(() => ({}))
  const allowed = ['stato', 'note', 'data_prossima_manutenzione', 'frequenza_manutenzione',
    'numero_seriale', 'fornitore_nome', 'categoria', 'nome']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  updates.updated_at = new Date().toISOString()

  const { error } = await adminDb
    .from('attrezzature').update(updates).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()
  if (body.stato) {
    await logActivityServer(user.id, userNome, `Attrezzatura stato → ${body.stato}`, params.id, 'altro')
  }

  return NextResponse.json({ ok: true, updates })
}

// POST /api/attrezzature/[id] — registra manutenzione
// Route separata non necessaria: uso action nel body per semplicità
