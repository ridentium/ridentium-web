import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── GET /api/crm/follow-up?filtro=oggi|settimana|scaduti ─────────────────────
// Restituisce gli ID dei contatti CRM che hanno un follow-up nel range richiesto.
// Usato dai filtri "Da richiamare oggi/questa settimana/Scaduti" nel frontend.
//
// Logica: un contatto rientra nel filtro se ha ALMENO UN'interazione con
// prossima_data nel range e (per scaduti) stato != 'perso'.

export async function GET(req: NextRequest) {
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

  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filtro = searchParams.get('filtro') as 'oggi' | 'settimana' | 'scaduti' | null

  if (!filtro || !['oggi', 'settimana', 'scaduti'].includes(filtro)) {
    return NextResponse.json({ error: 'Parametro filtro mancante o non valido' }, { status: 400 })
  }

  // Calcolo range date in formato ISO date (YYYY-MM-DD)
  const oggi = new Date()
  const todayStr = oggi.toISOString().slice(0, 10)

  const settimanaFine = new Date(oggi)
  settimanaFine.setDate(settimanaFine.getDate() + 7)
  const settimanaFineStr = settimanaFine.toISOString().slice(0, 10)

  // Step 1: trova i crm_contatto_id dalle interazioni che matchano il range
  let interazioniQuery = adminDb
    .from('crm_interazioni')
    .select('crm_contatto_id')
    .not('prossima_data', 'is', null)

  if (filtro === 'oggi') {
    interazioniQuery = interazioniQuery.eq('prossima_data', todayStr)
  } else if (filtro === 'settimana') {
    interazioniQuery = interazioniQuery
      .gte('prossima_data', todayStr)
      .lte('prossima_data', settimanaFineStr)
  } else {
    // scaduti
    interazioniQuery = interazioniQuery.lt('prossima_data', todayStr)
  }

  const { data: interazioni, error: intError } = await interazioniQuery

  if (intError) {
    console.error('[CRM-FollowUp] query interazioni error:', intError)
    return NextResponse.json({ error: 'Errore nel recupero follow-up' }, { status: 500 })
  }

  // Deduplicazione ID
  const seen = new Set<string>()
  const contattoIds: string[] = []
  for (const i of interazioni ?? []) {
    if (!seen.has(i.crm_contatto_id)) {
      seen.add(i.crm_contatto_id)
      contattoIds.push(i.crm_contatto_id)
    }
  }

  if (contattoIds.length === 0) {
    return NextResponse.json({ ids: [] })
  }

  // Step 2: verifica che i contatti esistano, non siano anonimizzati,
  // e (per "scaduti") non abbiano stato 'perso'
  let contattiQuery = adminDb
    .from('crm_contatti')
    .select('id')
    .eq('anonimizzato', false)
    .in('id', contattoIds)

  if (filtro === 'scaduti') {
    contattiQuery = contattiQuery.neq('stato', 'perso')
  }

  const { data: contatti, error: contattiError } = await contattiQuery

  if (contattiError) {
    console.error('[CRM-FollowUp] query contatti error:', contattiError)
    return NextResponse.json({ error: 'Errore nel recupero contatti' }, { status: 500 })
  }

  const ids = (contatti ?? []).map(c => c.id)
  return NextResponse.json({ ids })
}
