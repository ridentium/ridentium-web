import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'

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
    .select('ruolo, nome, cognome')
    .eq('id', user.id)
    .single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

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

  const nomeContatto = [data.nome, data.cognome].filter(Boolean).join(' ') || data.email || params.id
  const azione = 'stato' in body
    ? `CRM: stato aggiornato a "${body.stato}"`
    : 'note' in body
      ? 'CRM: note aggiornate'
      : 'CRM: contatto aggiornato'
  await logActivityServer(user.id, userNome, azione, nomeContatto, 'crm')

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
    .select('ruolo, nome, cognome')
    .eq('id', user.id)
    .single()
  if (!profilo || profilo.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo gli admin possono eliminare contatti' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // Recupera nome contatto prima dell'eliminazione per il log
  const { data: contattoInfo } = await adminDb
    .from('crm_contatti').select('nome, cognome, email').eq('id', params.id).single()
  const nomeContatto = contattoInfo
    ? [contattoInfo.nome, contattoInfo.cognome].filter(Boolean).join(' ') || contattoInfo.email || params.id
    : params.id

  const { error } = await adminDb
    .from('crm_contatti')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Errore nell\'eliminazione' }, { status: 500 })
  }

  await logActivityServer(user.id, userNome, 'CRM: contatto eliminato', nomeContatto, 'crm')

  return NextResponse.json({ success: true })
}
