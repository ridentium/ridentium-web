import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { createInterazioneSchema, zodError } from '@/lib/validation'

// ── Auth helper ───────────────────────────────────────────────────────────────

type AuthResult =
  | { ok: true; userId: string; nomeUtente: string; ruolo: string }
  | { ok: false; response: NextResponse }

async function requireCrmAccess(): Promise<AuthResult> {
  const supabase = createClient()
  const adminDb = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }),
    }
  }

  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo, nome, cognome')
    .eq('id', user.id)
    .single()

  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 }),
    }
  }

  const nomeUtente = [profilo.nome, profilo.cognome].filter(Boolean).join(' ') || user.email || user.id
  return { ok: true, userId: user.id, nomeUtente, ruolo: profilo.ruolo }
}

// ── GET /api/crm/contatti/[id]/interazioni ────────────────────────────────────
// Restituisce tutte le interazioni di un contatto, ordinate dalla più recente.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireCrmAccess()
  if (!auth.ok) return auth.response

  const adminDb = createAdminClient()
  const { id: contattoId } = params

  // Verifica che il contatto esista e non sia anonimizzato
  const { data: contatto, error: checkError } = await adminDb
    .from('crm_contatti')
    .select('id, anonimizzato')
    .eq('id', contattoId)
    .single()

  if (checkError || !contatto) {
    return NextResponse.json({ error: 'Contatto non trovato' }, { status: 404 })
  }

  const { data, error } = await adminDb
    .from('crm_interazioni')
    .select('*')
    .eq('crm_contatto_id', contattoId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[CRM-Interazioni] GET error:', error)
    return NextResponse.json({ error: 'Errore nel recupero interazioni' }, { status: 500 })
  }

  return NextResponse.json({ interazioni: data ?? [] })
}

// ── POST /api/crm/contatti/[id]/interazioni ───────────────────────────────────
// Aggiunge una nuova interazione al contatto.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireCrmAccess()
  if (!auth.ok) return auth.response

  const adminDb = createAdminClient()
  const { id: contattoId } = params

  // Verifica esistenza contatto
  const { data: contatto, error: checkError } = await adminDb
    .from('crm_contatti')
    .select('id, anonimizzato, nome, cognome')
    .eq('id', contattoId)
    .single()

  if (checkError || !contatto) {
    return NextResponse.json({ error: 'Contatto non trovato' }, { status: 404 })
  }

  if (contatto.anonimizzato) {
    return NextResponse.json(
      { error: 'Impossibile aggiungere interazioni a un contatto anonimizzato (GDPR)' },
      { status: 422 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const parsed = createInterazioneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { tipo, contenuto, prossima_azione, prossima_data } = parsed.data

  const { data, error } = await adminDb
    .from('crm_interazioni')
    .insert({
      crm_contatto_id: contattoId,
      tipo,
      contenuto:        contenuto.trim(),
      prossima_azione:  prossima_azione?.trim() || null,
      prossima_data:    prossima_data || null,
      creato_da:        auth.userId,
      creato_da_nome:   auth.nomeUtente,
    })
    .select()
    .single()

  if (error) {
    console.error('[CRM-Interazioni] POST error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio interazione' }, { status: 500 })
  }

  // Aggiorna updated_at del contatto padre per riflettere attività recente
  await adminDb
    .from('crm_contatti')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', contattoId)

  const nomeContatto =
    [contatto.nome, contatto.cognome].filter(Boolean).join(' ') || contattoId

  logActivityServer(
    auth.userId,
    auth.nomeUtente,
    `Interazione CRM (${tipo}): ${nomeContatto}`,
    contattoId,
    'crm',
  ).catch(() => {})

  return NextResponse.json({ interazione: data }, { status: 201 })
}
