import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/mailer'

// ─── CORS helper (landing page esterne) ───────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  }
}

// OPTIONS — preflight CORS per fetch da landing page esterne
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

// ─── POST /api/crm/contatti ────────────────────────────────────────────────────
// Endpoint PUBBLICO usato dalle landing page per registrare un lead.
// Richiede l'header  x-api-key: <CRM_API_KEY>  (se la variabile d'ambiente è impostata).
export async function POST(req: NextRequest) {
  const adminDb = createAdminClient()

  // Validazione API key (opzionale ma consigliata)
  const envKey = process.env.CRM_API_KEY
  if (envKey) {
    const sentKey = req.headers.get('x-api-key')
    if (sentKey !== envKey) {
      return NextResponse.json(
        { error: 'API key non valida' },
        { status: 401, headers: corsHeaders() }
      )
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Body JSON non valido' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const {
    nome, cognome, email, telefono, sorgente,
    consenso_privacy, consenso_marketing, consenso_versione, consenso_timestamp,
    note, fonte,
  } = body as {
    nome?: string
    cognome?: string
    email?: string
    telefono?: string
    sorgente?: string
    fonte?: string                 // alias per compatibilità
    consenso_privacy?: boolean
    consenso_marketing?: boolean
    consenso_versione?: string
    consenso_timestamp?: string
    note?: string
  }

  // Almeno un contatto (email o telefono) è obbligatorio
  if (!email?.trim() && !telefono?.trim()) {
    return NextResponse.json(
      { error: 'Inserisci almeno email o telefono' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const { data, error } = await adminDb
    .from('crm_contatti')
    .insert({
      nome:               nome?.trim()      || null,
      cognome:            cognome?.trim()   || null,
      email:              email?.trim()     || null,
      telefono:           telefono?.trim()  || null,
      sorgente:           sorgente?.trim()  || fonte?.trim() || null,
      stato:              'nuovo',
      note:               note?.trim()      || null,
      consenso_privacy:   consenso_privacy  ?? false,
      consenso_marketing: consenso_marketing ?? false,
      consenso_versione:  consenso_versione  || null,
      consenso_timestamp: consenso_timestamp || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[CRM] INSERT error:', error)
    return NextResponse.json(
      { error: 'Errore nel salvataggio' },
      { status: 500, headers: corsHeaders() }
    )
  }

  // ── Email automatica di conferma ─────────────────────────────────────────
  // IMPORTANTE: await esplicito — su Vercel serverless le promise pendenti
  // vengono terminate insieme alla funzione non appena viene restituita la
  // response. Il fire-and-forget non funziona: l'SMTP non fa in tempo a
  // completare la connessione prima che il processo venga killato.
  if (email?.trim()) {
    try {
      await sendEmail({
        to: email.trim(),
        nome: nome?.trim() || '',
        template: 'box-conferma',
      })
    } catch (err) {
      console.warn('[CRM] Auto-email box-conferma failed:', err)
    }
  }

  return NextResponse.json(
    { success: true, id: data.id },
    { status: 201, headers: corsHeaders() }
  )
}

// ─── GET /api/crm/contatti ─────────────────────────────────────────────────────
// Protetto — solo admin/manager autenticati.
// Query params:
//   ?format=csv   → esporta CSV
//   ?stato=nuovo  → filtra per stato
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Verifica ruolo admin o manager
  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const formato = searchParams.get('format')
  const stato   = searchParams.get('stato')

  const base = adminDb
    .from('crm_contatti')
    .select('*')
    .order('created_at', { ascending: false })

  const { data, error } = await (stato ? base.eq('stato', stato) : base)

  if (error) {
    return NextResponse.json({ error: 'Errore nel recupero dati' }, { status: 500 })
  }

  // Export CSV
  if (formato === 'csv') {
    const headers = [
      'ID', 'Nome', 'Cognome', 'Email', 'Telefono', 'Stato', 'Sorgente', 'Note',
      'Privacy Accettata', 'Marketing Accettato', 'Versione Informativa', 'Data Consenso', 'Data Registrazione',
    ]
    const rows = (data ?? []).map(r => [
      r.id,
      r.nome ?? '',
      r.cognome ?? '',
      r.email ?? '',
      r.telefono ?? '',
      r.stato,
      r.sorgente ?? '',
      (r.note ?? '').replace(/"/g, '""'),
      r.consenso_privacy    ? 'Sì' : 'No',
      r.consenso_marketing  ? 'Sì' : 'No',
      r.consenso_versione   ?? '',
      r.consenso_timestamp  ? new Date(r.consenso_timestamp).toLocaleDateString('it-IT') : '',
      new Date(r.created_at).toLocaleDateString('it-IT'),
    ].map(v => `"${v}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="crm_contatti_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ contatti: data })
}
