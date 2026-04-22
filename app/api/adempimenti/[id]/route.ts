import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/adempimenti/[id] — aggiorna (solo admin/manager)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    'prossima_scadenza','note','attivo',
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in body) updates[k] = body[k]

  const { data, error } = await adminDb
    .from('adempimenti').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ adempimento: data })
}

// DELETE /api/adempimenti/[id] — soft delete (disattiva) — solo admin
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || profilo.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo admin può disattivare adempimenti' }, { status: 403 })
  }

  const { error } = await adminDb
    .from('adempimenti').update({ attivo: false, updated_at: new Date().toISOString() }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
