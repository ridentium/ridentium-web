import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── PATCH /api/crm/contatti/[id] ─────────────────────────────────────────────
// Aggiorna stato, note o dati anagrafici di un contatto.
// Protetto — solo admin/manager autenticati.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const body = await req.json()

  // Permette di aggiornare solo i campi consentiti
  const allowed = ['stato', 'note', 'nome', 'cognome', 'email', 'telefono', 'sorgente']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await adminDb
    .from('crm_contatti')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }

  return NextResponse.json({ contatto: data })
}

// ─── DELETE /api/crm/contatti/[id] ────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()
  if (!profilo || profilo.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo gli admin possono eliminare contatti' }, { status: 403 })
  }

  const { error } = await adminDb
    .from('crm_contatti')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Errore nell\'eliminazione' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
