import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/mailer'
import { createNotifica } from '@/lib/notifiche'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logActivityServer } from '@/lib/registro-server'

// Rate limit: 5 richieste per ora per IP.
// Protegge da spam sul form landing anche in presenza di API key valida.
const CRM_RATE_LIMIT = 5
const CRM_WINDOW_MS  = 60 * 60 * 1000  // 1 ora

// ─── CORS helper ──────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

// ─── POST /api/crm/contatti ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const adminDb = createAdminClient()

  // ── 1. Sessione interna (admin/manager/segretaria) ────────────────────────
  // Verificata PRIMA del rate limit: le chiamate interne dal gestionale
  // non devono consumare il budget IP riservato al form landing pubblico.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isInternalAuthorized = false
  if (user) {
    const { data: profilo } = await adminDb
      .from('profili').select('ruolo').eq('id', user.id).single()
    isInternalAuthorized = ['admin', 'manager', 'segretaria'].includes(profilo?.ruolo ?? '')
  }

  // ── 2. Rate limiting — solo per chiamate esterne (form landing/pubblico) ──
  if (!isInternalAuthorized) {
    const ip = getClientIp(req.headers)
    const rl = checkRateLimit(`crm:${ip}`, CRM_RATE_LIMIT, CRM_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Troppe richieste. Riprova tra qualche minuto.' },
        { status: 429, headers: { ...corsHeaders(), 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }
  }

  // ── 3. Auth — API key (form esterno) OPPURE sessione interna ──────────────
  // - Form esterno (landing Gift Box): deve inviare x-api-key valida
  // - Gestionale interno (admin/manager/segretaria): accettato via sessione
  // - Nessuno dei due → 401
  const envKey  = process.env.CRM_API_KEY
  const sentKey = req.headers.get('x-api-key')
  const isValidApiKey = Boolean(envKey && sentKey === envKey)

  if (!isValidApiKey && !isInternalAuthorized) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401, headers: corsHeaders() })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400, headers: corsHeaders() })
  }

  const {
    nome, cognome, email, telefono, sorgente, nota, note, fonte,
    consenso_privacy, consenso_marketing, consenso_versione, consenso_timestamp,
  } = body as {
    nome?: string; cognome?: string; email?: string; telefono?: string
    sorgente?: string; fonte?: string; nota?: string; note?: string
    consenso_privacy?: boolean; consenso_marketing?: boolean
    consenso_versione?: string; consenso_timestamp?: string
  }

  if (!email?.trim() && !telefono?.trim()) {
    return NextResponse.json(
      { error: 'Inserisci almeno email o telefono' },
      { status: 400, headers: corsHeaders() }
    )
  }

  const { data, error } = await adminDb
    .from('crm_contatti')
    .insert({
      nome: nome?.trim() || null,
      cognome: cognome?.trim() || null,
      email: email?.trim() || null,
      telefono: telefono?.trim() || null,
      sorgente: sorgente?.trim() || fonte?.trim() || null,
      stato: 'nuovo',
      note: (note ?? nota)?.trim() || null,
      consenso_privacy: consenso_privacy ?? false,
      consenso_marketing: consenso_marketing ?? false,
      consenso_versione: consenso_versione || null,
      consenso_timestamp: consenso_timestamp || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[CRM] INSERT error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500, headers: corsHeaders() })
  }

  // Email di conferma al contatto
  if (email?.trim()) {
    try {
      await sendEmail({ to: email.trim(), nome: nome?.trim() || '', template: 'box-conferma' })
    } catch (err) { console.warn('[CRM] Auto-email box-conferma failed:', err) }
  }

  // Notifica interna agli admin — nuovo lead nel CRM
  const nomeDisplay = [nome?.trim(), cognome?.trim()].filter(Boolean).join(' ') || email?.trim() || telefono?.trim() || 'Nuovo contatto'
  try {
    await createNotifica({
      ruoli: ['admin'],
      tipo: 'crm',
      titolo: `Nuovo lead: ${nomeDisplay}`,
      corpo: sorgente?.trim() ? `Sorgente: ${sorgente.trim()}` : undefined,
      url: '/admin/crm',
      push: true,
    })
  } catch (e) { console.error('[CRM] Notifica failed:', e) }

  return NextResponse.json({ success: true, id: data.id }, { status: 201, headers: corsHeaders() })
}

// ─── GET /api/crm/contatti ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb.from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const formato = searchParams.get('format')
  const stato   = searchParams.get('stato')

  // Esclude sempre i record anonimizzati dalla vista operativa.
  // I record GDPR sono conservati solo per audit a livello DB.
  const base = adminDb
    .from('crm_contatti')
    .select('*')
    .eq('anonimizzato', false)
    .order('created_at', { ascending: false })
  const { data, error } = await (stato ? base.eq('stato', stato) : base)

  if (error) return NextResponse.json({ error: 'Errore nel recupero dati' }, { status: 500 })

  if (formato === 'csv') {
    const headers = [
      'ID','Nome','Cognome','Email','Telefono','Stato','Sorgente','Note',
      'Privacy Accettata','Marketing Accettato','Versione Informativa','Data Consenso','Data Registrazione',
    ]
    const rows = (data ?? []).map(r => [
      r.id, r.nome ?? '', r.cognome ?? '', r.email ?? '', r.telefono ?? '',
      r.stato, r.sorgente ?? '', (r.note ?? '').replace(/"/g, '""'),
      r.consenso_privacy ? 'Sì' : 'No', r.consenso_marketing ? 'Sì' : 'No',
      r.consenso_versione ?? '',
      r.consenso_timestamp ? new Date(r.consenso_timestamp).toLocaleDateString('it-IT') : '',
      new Date(r.created_at).toLocaleDateString('it-IT'),
    ].map(v => `"${v}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')

    // Audit GDPR: ogni export di dati personali deve essere tracciato
    const nomeUtente = `${(profilo as { nome?: string }).nome ?? ''} (${profilo.ruolo})`.trim()
    logActivityServer(
      user.id, nomeUtente,
      `Export CSV contatti CRM — ${(data ?? []).length} record${stato ? ` (filtro stato: ${stato})` : ''}`,
      `export_${new Date().toISOString().slice(0,10)}`,
      'crm',
    ).catch(() => {}) // non blocca la risposta

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
