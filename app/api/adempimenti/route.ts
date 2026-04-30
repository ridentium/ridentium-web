import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/adempimenti — lista adempimenti attivi con responsabile e consulente
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()

  const { data: adempimenti, error } = await adminDb
    .from('adempimenti')
    .select(`
      *,
      responsabile_profilo:profili!adempimenti_responsabile_profilo_id_fkey(id, nome, cognome),
      consulente:consulenti(id, ruolo, nome)
    `)
    .eq('attivo', true)
    .order('prossima_scadenza', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[adempimenti GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: consulenti } = await adminDb
    .from('consulenti')
    .select('id, ruolo, nome, email, telefono, attivo')
    .eq('attivo', true)
    .order('ruolo')

  const { data: profili } = await adminDb
    .from('profili')
    .select('id, nome, cognome, ruolo')
    .eq('attivo', true)
    .order('nome')

  return NextResponse.json({ adempimenti: adempimenti ?? [], consulenti: consulenti ?? [], profili: profili ?? [] })
}

// POST /api/adempimenti — crea nuovo adempimento (solo admin/manager)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = [
    'titolo','descrizione','categoria','frequenza',
    'responsabile_profilo_id','consulente_id','responsabile_etichetta',
    'evidenza_richiesta','riferimento_normativo','preavviso_giorni',
    'prossima_scadenza','note',
  ]
  const insert: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) insert[k] = body[k]
  if (!insert.titolo || !insert.frequenza || !insert.categoria) {
    return NextResponse.json({ error: 'titolo, categoria e frequenza obbligatori' }, { status: 400 })
  }

  const { data, error } = await adminDb
    .from('adempimenti').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ adempimento: data })
}
