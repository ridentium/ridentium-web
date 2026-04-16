import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendConfermaIscrizione } from '@/lib/mailer'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest) {
  const adminDb = createAdminClient()

  const envKey = process.env.CRM_API_KEY
  if (envKey && req.headers.get('x-api-key') !== envKey) {
    return NextResponse.json({ error: 'API key non valida' }, { status: 401, headers: corsHeaders() })
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400, headers: corsHeaders() })
  }

  const { nome, cognome, email, telefono, sorgente,
          consenso_privacy, consenso_marketing, consenso_versione, consenso_timestamp } = body as Record<string, unknown>

  if (!String(email ?? '').trim() && !String(telefono ?? '').trim()) {
    return NextResponse.json({ error: 'Inserisci almeno email o telefono' }, { status: 400, headers: corsHeaders() })
  }

  const { data, error } = await adminDb
    .from('crm_contatti')
    .insert({
      nome:                String(nome     ?? '').trim() || null,
      cognome:             String(cognome  ?? '').trim() || null,
      email:               String(email    ?? '').trim() || null,
      telefono:            String(telefono ?? '').trim() || null,
      sorgente:            String(sorgente ?? '').trim() || null,
      stato:               'nuovo',
      consenso_privacy:    consenso_privacy    === true || consenso_privacy    === 'true',
      consenso_marketing:  consenso_marketing  === true || consenso_marketing  === 'true',
      consenso_versione:   String(consenso_versione ?? 'v1.0'),
      consenso_timestamp:  consenso_timestamp  ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[CRM] INSERT error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500, headers: corsHeaders() })
  }

    // Email di conferma al lead (fire & forget)
  if (data?.email) {
    sendConfermaIscrizione({ nome: data.nome || '', email: data.email }).catch(() => {})
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 201, headers: corsHeaders() })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const formato = searchParams.get('format')
  const stato   = searchParams.get('stato')

  const base = adminDb
    .from('crm_contatti').select('*')
    .order('created_at', { ascending: false })

  const { data, error } = await (stato ? base.eq('stato', stato) : base)
  if (error) return NextResponse.json({ error: 'Errore nel recupero dati' }, { status: 500 })

  if (formato === 'csv') {
    const headers = ['ID','Nome','Cognome','Email','Telefono','Stato','Sorgente','Note',
                     'Privacy Accettata','Marketing Accettato','Versione Informativa','Data Consenso','Data Registrazione']
    const rows = (data ?? []).map(r => [
      r.id, r.nome??'', r.cognome??'', r.email??'', r.telefono??'',
      r.stato, r.sorgente??'', (r.note??'').replace(/"/g,'""'),
      r.consenso_privacy   ? 'Sì' : 'No',
      r.consenso_marketing ? 'Sì' : 'No',
      r.consenso_versione  ?? '',
      r.consenso_timestamp ? new Date(r.consenso_timestamp).toLocaleDateString('it-IT') : '',
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
