import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/profilo/prefs — legge tutte le preferenze UI dell'utente corrente
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data } = await adminDb
    .from('user_prefs')
    .select('prefs')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ prefs: data?.prefs ?? {} })
}

// PUT /api/profilo/prefs — upsert una singola chiave nelle preferenze
// Body: { key: string, value: unknown }
// Usa JSONB merge (||) per aggiornamenti non distruttivi multi-device.
export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.key !== 'string' || body.key.length === 0) {
    return NextResponse.json({ error: 'key mancante' }, { status: 400 })
  }
  if (!('value' in body)) {
    return NextResponse.json({ error: 'value mancante' }, { status: 400 })
  }

  const adminDb = createAdminClient()

  // Upsert: crea la riga se non esiste, altrimenti merge JSONB chiave per chiave
  const { error } = await adminDb.rpc('upsert_user_pref', {
    p_user_id: user.id,
    p_key:     body.key,
    p_value:   JSON.stringify(body.value),
  })

  // Fallback se la RPC non esiste ancora: plain upsert con payload completo
  if (error) {
    const { data: existing } = await adminDb
      .from('user_prefs').select('prefs').eq('user_id', user.id).maybeSingle()
    const merged = { ...(existing?.prefs ?? {}), [body.key]: body.value }
    const { error: e2 } = await adminDb
      .from('user_prefs')
      .upsert({ user_id: user.id, prefs: merged, updated_at: new Date().toISOString() })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
