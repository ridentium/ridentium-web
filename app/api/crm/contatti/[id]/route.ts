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

  // Blocca modifiche su contatti gia anonimizzati (GDPR — i dati non possono
  // essere reinseriti dopo una richiesta di oblio)
  const { data: current } = await adminDb
    .from('crm_contatti').select('anonimizzato').eq('id', params.id).single()
  if (current?.anonimizzato) {
    return NextResponse.json({ error: 'Contatto anonimizzato — modifica non consentita' }, { status: 409 })
  }

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
// GDPR art. 17 — Diritto all'oblio: anonimizzazione invece di DELETE fisico.
// I dati personali vengono azzerati. Il record resta per audit e statistiche
// aggregate ma non appare mai nella vista operativa (filtro anonimizzato=false).
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
    return NextResponse.json({ error: 'Solo gli admin possono anonimizzare contatti' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // Legge il contatto PRIMA di anonimizzarlo — serve per il log e per i controlli
  const { data: contattoInfo, error: fetchError } = await adminDb
    .from('crm_contatti')
    .select('id, nome, cognome, email, stato, anonimizzato')
    .eq('id', params.id)
    .single()

  if (fetchError || !contattoInfo) {
    return NextResponse.json({ error: 'Contatto non trovato' }, { status: 404 })
  }

  // Idempotenza: se e gia anonimizzato non fa nulla
  if (contattoInfo.anonimizzato) {
    return NextResponse.json({ error: 'Contatto gia anonimizzato' }, { status: 409 })
  }

  // Identificatore per il log — usiamo nome+email PRIMA di azzerarli,
  // poi nel registro resta solo il riferimento senza i dati personali.
  const nomeContatto =
    [contattoInfo.nome, contattoInfo.cognome].filter(Boolean).join(' ') ||
    contattoInfo.email ||
    `ID ${params.id.slice(0, 8)}`

  // ── Anonimizzazione ────────────────────────────────────────────────────────
  // Campi personali azzerati: nome, cognome, email, telefono, note, sorgente.
  // Campi conservati per audit/statistiche: id, stato, consensi, created_at.
  const { error: anonError } = await adminDb
    .from('crm_contatti')
    .update({
      nome:             null,
      cognome:          null,
      email:            null,
      telefono:         null,
      note:             null,
      sorgente:         null,
      anonimizzato:     true,
      gdpr_deleted_at:  new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', params.id)

  if (anonError) {
    console.error('[CRM DELETE] anonimizzazione fallita:', anonError)
    return NextResponse.json({ error: 'Errore durante l\'anonimizzazione' }, { status: 500 })
  }

  // Audit log — registra l'evento con riferimento non personale
  await logActivityServer(
    user.id,
    userNome,
    'CRM: contatto anonimizzato (GDPR art. 17 — diritto all\'oblio)',
    `${nomeContatto} — tutti i dati personali rimossi`,
    'crm',
  )

  return NextResponse.json({ success: true })
}
