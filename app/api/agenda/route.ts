import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AgendaEvent } from '@/types/agenda'

/**
 * GET /api/agenda
 * Agenda unificata: Task aperti + Ricorrenti attive + Adempimenti attivi.
 *
 * Query params:
 *   - giorni  (default 60): quanti giorni futuri includere per task e adempimenti
 *   - tutti   (default false per staff, true per admin/manager):
 *             se "false" mostra solo gli eventi assegnati all'utente corrente
 */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()
  if (!profilo) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })

  const url = new URL(req.url)
  const giorni = parseInt(url.searchParams.get('giorni') ?? '60', 10)
  const isAdmin = ['admin', 'manager'].includes(profilo.ruolo)
  // admin/manager vedono tutto per default; staff solo i propri
  const tuttiParam = url.searchParams.get('tutti')
  const mostraTutti = isAdmin ? tuttiParam !== 'false' : false

  const oggi = new Date()
  const oggiStr = oggi.toISOString().split('T')[0]
  const fino = new Date(oggi.getTime() + giorni * 24 * 60 * 60 * 1000)
  const finoStr = fino.toISOString().split('T')[0]

  const events: AgendaEvent[] = []

  // ── 1. TASK ────────────────────────────────────────────────────────────────
  {
    let q = adminDb
      .from('tasks')
      .select(`
        id, titolo, descrizione, stato, priorita, scadenza,
        assegnato_a,
        assegnato_a_profilo:profili!tasks_assegnato_a_fkey(id, nome, cognome)
      `)
      .in('stato', ['da_fare', 'in_corso'])
      .order('scadenza', { ascending: true, nullsFirst: false })

    if (!mostraTutti) {
      q = (q as any).eq('assegnato_a', user.id)
    }

    const { data: tasks } = await q

    for (const t of tasks ?? []) {
      const profAssegnato = (t as any).assegnato_a_profilo
      events.push({
        id: t.id,
        tipo: 'task',
        titolo: t.titolo,
        descrizione: t.descrizione ?? null,
        data: t.scadenza ?? null,
        stato: t.stato,
        priorita: t.priorita,
        assegnato_a_id: t.assegnato_a ?? null,
        assegnato_a_nome: profAssegnato
          ? `${profAssegnato.nome} ${profAssegnato.cognome}`.trim()
          : null,
        href: isAdmin ? '/admin/tasks' : '/staff/tasks',
      })
    }
  }

  // ── 2. RICORRENTI ──────────────────────────────────────────────────────────
  // Le ricorrenti non hanno una data fissa: le includiamo sempre nell'agenda
  // con data=null (verranno mostrate come "ricorrente" senza data specifica).
  // Staff vede le proprie + quelle non assegnate; admin vede tutte.
  {
    let q = adminDb
      .from('ricorrenti')
      .select(`
        id, titolo, descrizione, frequenza, assegnato_a, attiva,
        assegnato_a_profilo:profili!ricorrenti_assegnato_a_fkey(id, nome, cognome)
      `)
      .eq('attiva', true)
      .order('frequenza')

    const { data: ricorrenti } = await q

    for (const r of ricorrenti ?? []) {
      const assegnatoId = (r as any).assegnato_a ?? null
      // Visibilità: admin vede tutto; staff vede le proprie e non assegnate
      if (!mostraTutti && assegnatoId !== null && assegnatoId !== user.id) continue

      const profAssegnato = (r as any).assegnato_a_profilo
      events.push({
        id: r.id,
        tipo: 'ricorrente',
        titolo: r.titolo,
        descrizione: (r as any).descrizione ?? null,
        data: null,
        frequenza: r.frequenza,
        attiva: (r as any).attiva ?? true,
        assegnato_a_id: assegnatoId,
        assegnato_a_nome: profAssegnato
          ? `${profAssegnato.nome} ${profAssegnato.cognome}`.trim()
          : null,
        href: isAdmin ? '/admin/ricorrenti' : '/staff/ricorrenti',
      })
    }
  }

  // ── 3. ADEMPIMENTI ─────────────────────────────────────────────────────────
  // Tutti vedono tutti gli adempimenti; staff li vede ma quelli assegnati a sé
  // vengono evidenziati lato frontend.
  {
    const { data: adempimenti } = await adminDb
      .from('adempimenti')
      .select(`
        id, titolo, categoria, prossima_scadenza, preavviso_giorni,
        responsabile_profilo_id,
        responsabile_profilo:profili!adempimenti_responsabile_profilo_id_fkey(id, nome, cognome),
        responsabile_etichetta
      `)
      .eq('attivo', true)
      .order('prossima_scadenza', { ascending: true, nullsFirst: false })

    for (const a of adempimenti ?? []) {
      const profResp = (a as any).responsabile_profilo
      const responsabileNome = profResp
        ? `${profResp.nome} ${profResp.cognome}`.trim()
        : ((a as any).responsabile_etichetta ?? null)

      events.push({
        id: a.id,
        tipo: 'adempimento',
        titolo: a.titolo,
        data: a.prossima_scadenza ?? null,
        categoria: a.categoria ?? null,
        frequenza: (a as any).frequenza ?? null,
        preavviso_giorni: a.preavviso_giorni ?? null,
        responsabile_etichetta: (a as any).responsabile_etichetta ?? null,
        assegnato_a_id: a.responsabile_profilo_id ?? null,
        assegnato_a_nome: responsabileNome,
        href: isAdmin ? '/admin/adempimenti' : '/staff/adempimenti',
      })
    }
  }

  // Ordina: prima gli eventi con data (per data asc), poi quelli senza data (ricorrenti)
  events.sort((a, b) => {
    if (a.data && b.data) return a.data.localeCompare(b.data)
    if (a.data && !b.data) return -1
    if (!a.data && b.data) return 1
    return 0
  })

  // Profili per il pannello "Aggiungi"
  const { data: profiliList } = await adminDb
    .from('profili')
    .select('id, nome, cognome, ruolo')
    .order('cognome')

  return NextResponse.json({
    events,
    profili: profiliList ?? [],
    meta: {
      oggi: oggiStr,
      fino: finoStr,
      giorni,
      mostraTutti,
      ruolo: profilo.ruolo,
      userId: user.id,
    },
  })
}
