import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'

// GET /api/attrezzature — lista con ultime manutenzioni
export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('attrezzature')
    .select('*, manutenzioni(id, data, tipo, eseguito_da, note, prossima_data, creato_da_nome, created_at)')
    .order('nome', { ascending: true })
    .order('created_at', { referencedTable: 'manutenzioni', ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attrezzature: data ?? [] })
}

// POST /api/attrezzature — crea nuova attrezzatura (solo admin)
export async function POST(req: NextRequest) {
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
  if (!body || !body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  }

  const { error, data } = await adminDb
    .from('attrezzature')
    .insert({
      nome:                       body.nome.trim(),
      categoria:                  body.categoria?.trim() || 'altro',
      numero_seriale:             body.numero_seriale?.trim() || null,
      fornitore_nome:             body.fornitore_nome?.trim() || null,
      data_acquisto:              body.data_acquisto || null,
      frequenza_manutenzione:     body.frequenza_manutenzione || 'annuale',
      data_ultima_manutenzione:   body.data_ultima_manutenzione || null,
      data_prossima_manutenzione: body.data_prossima_manutenzione || null,
      stato:                      body.stato || 'operativo',
      note:                       body.note?.trim() || null,
      created_by:                 user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()
  await logActivityServer(user.id, userNome, `Attrezzatura aggiunta: ${body.nome.trim()}`, undefined, 'altro')

  return NextResponse.json({ attrezzatura: data })
}
