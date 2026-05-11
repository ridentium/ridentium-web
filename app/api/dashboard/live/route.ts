import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Tipi risposta ────────────────────────────────────────────────────────────

export interface MagazzinoAlert {
  id: string
  prodotto: string
  quantita: number
  soglia_minima: number
  categoria: string
}

export interface OrdineAperto {
  id: string
  fornitore_nome: string
  stato: string
  data_invio: string
  giorni: number // giorni da data_invio
}

export interface AdempimentoUrgente {
  id: string
  titolo: string
  categoria: string
  prossima_scadenza: string
  gg: number     // giorni alla scadenza (negativo = scaduto)
  scaduto: boolean
}

export interface TaskUrgente {
  id: string
  titolo: string
  priorita: string
  scadenza: string | null
  scaduto: boolean // scadenza < oggi
}

export interface AttrezzaturaAlert {
  id: string
  nome: string
  categoria: string
  data_prossima_manutenzione: string
  gg: number // giorni alla manutenzione (negativo = già scaduta)
}

export interface CrmFollowUpItem {
  contattoId: string
  nome: string | null
  cognome: string | null
  prossima_data: string
}

export interface DashboardLiveData {
  ts: string
  magazzino: {
    sottoSoglia: number
    items: MagazzinoAlert[]
  }
  ordini: {
    aperti: number
    stantii: number // inviato da > GIORNI_STANTIO gg
    items: OrdineAperto[]
  }
  adempimenti: {
    scaduti: number
    inScadenza: number // entro 7 gg
    items: AdempimentoUrgente[]
  }
  tasks: {
    urgentiAperti: number // priorità alta, non completato
    scadutiAperti: number // scadenza < oggi, non completato
    items: TaskUrgente[]
  }
  attrezzature: {
    entro30gg: number
    items: AttrezzaturaAlert[]
  }
  crmFollowUp: {
    scaduti: number
    oggi: number
    settimana: number
    items: CrmFollowUpItem[]
  }
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const GIORNI_STANTIO   = 3  // ordine "stantio" se inviato da più di X giorni
const GIORNI_ADEMPIMENTI = 7  // adempimenti urgenti se scadono entro X giorni
const GIORNI_MANUTENZIONE = 30 // attrezzature se manutenzione entro X giorni
const MAX_ITEMS = 5 // preview max per sezione nel widget

// ─── Helper date ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysDiff(fromStr: string, toDate: Date): number {
  const from = new Date(fromStr.length === 10 ? fromStr + 'T00:00:00' : fromStr)
  from.setHours(0, 0, 0, 0)
  const to = new Date(toDate)
  to.setHours(0, 0, 0, 0)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

// ─── GET /api/dashboard/live ──────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()

  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  // Date di riferimento
  const oggi = new Date()
  const todayStr          = toDateStr(oggi)
  const in7 = new Date(oggi); in7.setDate(oggi.getDate() + 7)
  const in7daysStr        = toDateStr(in7)
  const in30 = new Date(oggi); in30.setDate(oggi.getDate() + GIORNI_MANUTENZIONE)
  const in30daysStr       = toDateStr(in30)
  const minus30 = new Date(oggi); minus30.setDate(oggi.getDate() - 30)
  const minus30daysStr    = toDateStr(minus30)

  // Tutte le query in parallelo — solo lettura, nessuna modifica
  const [
    { data: magazzinoAll },
    { data: ordiniAperti },
    { data: adempimentiRaw },
    { data: tasksOpen },
    { data: attrezzatureRaw },
    { data: crmInterazioniRaw },
  ] = await Promise.all([
    // 1. Magazzino — tutti gli item (colonne minimali)
    adminDb.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria'),

    // 2. Ordini in attesa (non ancora ricevuti)
    adminDb
      .from('ordini')
      .select('id, fornitore_nome, stato, data_invio')
      .in('stato', ['inviato', 'confermato_fornitore', 'in_consegna'])
      .order('data_invio', { ascending: true }),

    // 3. Adempimenti attivi con scadenza entro 7 giorni (inclusi scaduti)
    adminDb
      .from('adempimenti')
      .select('id, titolo, categoria, prossima_scadenza')
      .eq('attivo', true)
      .not('prossima_scadenza', 'is', null)
      .lte('prossima_scadenza', in7daysStr)
      .order('prossima_scadenza', { ascending: true }),

    // 4. Task aperti (filtro urgenza/scadenza fatto JS-side)
    adminDb
      .from('tasks')
      .select('id, titolo, priorita, scadenza, stato')
      .neq('stato', 'completato')
      .is('deleted_at', null)
      .order('scadenza', { ascending: true, nullsFirst: false }),

    // 5. Attrezzature con manutenzione entro 30 giorni
    adminDb
      .from('attrezzature')
      .select('id, nome, categoria, data_prossima_manutenzione')
      .not('data_prossima_manutenzione', 'is', null)
      .lte('data_prossima_manutenzione', in30daysStr)
      .order('data_prossima_manutenzione', { ascending: true }),

    // 6. Interazioni CRM con follow-up pendente (da -30 a +7 gg)
    adminDb
      .from('crm_interazioni')
      .select('crm_contatto_id, prossima_data')
      .not('prossima_data', 'is', null)
      .gte('prossima_data', minus30daysStr)
      .lte('prossima_data', in7daysStr)
      .order('prossima_data', { ascending: true }),
  ])

  // ── 1. Magazzino sotto soglia ──────────────────────────────────────────────
  const sottoSoglia = (magazzinoAll ?? []).filter(
    (i: { quantita: number; soglia_minima: number }) => i.quantita < i.soglia_minima
  ) as MagazzinoAlert[]

  // ── 2. Ordini aperti + stantii ────────────────────────────────────────────
  const ordiniProcessed: OrdineAperto[] = (ordiniAperti ?? []).map((o: {
    id: string; fornitore_nome: string; stato: string; data_invio: string
  }) => ({
    id: o.id,
    fornitore_nome: o.fornitore_nome,
    stato: o.stato,
    data_invio: o.data_invio,
    giorni: daysDiff(o.data_invio, oggi),
  }))
  const stantii = ordiniProcessed.filter(o => o.stato === 'inviato' && o.giorni > GIORNI_STANTIO)

  // ── 3. Adempimenti urgenti (entro 7gg + scaduti) ──────────────────────────
  const adempimentiProcessed: AdempimentoUrgente[] = (adempimentiRaw ?? []).map((a: {
    id: string; titolo: string; categoria: string; prossima_scadenza: string
  }) => {
    const gg = daysDiff(todayStr, new Date(a.prossima_scadenza + 'T00:00:00')) * -1
    // gg > 0 = scaduto da X giorni, gg <= 0 = scade fra |gg| giorni
    const ggAllaScadenza = daysDiff(a.prossima_scadenza + 'T00:00:00', oggi) * -1
    return {
      id: a.id,
      titolo: a.titolo,
      categoria: a.categoria,
      prossima_scadenza: a.prossima_scadenza,
      gg: ggAllaScadenza,
      scaduto: a.prossima_scadenza < todayStr,
    }
  })
  const adScaduti   = adempimentiProcessed.filter(a => a.scaduto)
  const adInScadenza = adempimentiProcessed.filter(a => !a.scaduto)

  // ── 4. Task urgenti/scaduti ───────────────────────────────────────────────
  const tasksProcessed = (tasksOpen ?? []).map((t: {
    id: string; titolo: string; priorita: string; scadenza: string | null; stato: string
  }) => ({
    id: t.id,
    titolo: t.titolo,
    priorita: t.priorita,
    scadenza: t.scadenza,
    scaduto: !!t.scadenza && t.scadenza < todayStr,
  }))
  const tasksUrgenti = tasksProcessed.filter(t => t.priorita === 'alta')
  const tasksScaduti = tasksProcessed.filter(t => t.scaduto)
  // Preview: scaduti prima, poi urgenti (alta priorità), no duplicati
  const tasksPreview = [
    ...tasksScaduti,
    ...tasksUrgenti.filter(t => !t.scaduto),
  ].slice(0, MAX_ITEMS) as TaskUrgente[]

  // ── 5. Attrezzature con manutenzione entro 30gg ───────────────────────────
  const attrezzatureProcessed: AttrezzaturaAlert[] = (attrezzatureRaw ?? []).map((a: {
    id: string; nome: string; categoria: string; data_prossima_manutenzione: string
  }) => ({
    id: a.id,
    nome: a.nome,
    categoria: a.categoria,
    data_prossima_manutenzione: a.data_prossima_manutenzione,
    gg: -daysDiff(a.data_prossima_manutenzione + 'T00:00:00', oggi),
  }))

  // ── 6. Follow-up CRM ──────────────────────────────────────────────────────
  // Deduplicazione per contatto (un contatto può avere più interazioni pendenti)
  const crmContattoIdSet = new Set<string>()
  const crmContattoIds: string[] = []
  for (const i of crmInterazioniRaw ?? []) {
    if (!crmContattoIdSet.has(i.crm_contatto_id)) {
      crmContattoIdSet.add(i.crm_contatto_id)
      crmContattoIds.push(i.crm_contatto_id)
    }
  }

  // Fetch dettagli contatti validi (non anonimizzati, non persi)
  let crmContatti: { id: string; nome: string | null; cognome: string | null }[] = []
  if (crmContattoIds.length > 0) {
    const { data } = await adminDb
      .from('crm_contatti')
      .select('id, nome, cognome')
      .in('id', crmContattoIds)
      .eq('anonimizzato', false)
      .neq('stato', 'perso')
    crmContatti = data ?? []
  }

  const validCrmIds = new Set(crmContatti.map(c => c.id))
  const crmInfoMap = new Map(crmContatti.map(c => [c.id, c]))

  // Per ogni contatto valido, prendi la prossima_data più urgente (minima)
  const contattoMinDate = new Map<string, string>()
  for (const i of crmInterazioniRaw ?? []) {
    if (!validCrmIds.has(i.crm_contatto_id)) continue
    const existing = contattoMinDate.get(i.crm_contatto_id)
    if (!existing || i.prossima_data < existing) {
      contattoMinDate.set(i.crm_contatto_id, i.prossima_data)
    }
  }

  let crmScaduti = 0, crmOggi = 0, crmSettimana = 0
  const crmItems: CrmFollowUpItem[] = []

  contattoMinDate.forEach((date, contattoId) => {
    const info = crmInfoMap.get(contattoId)
    if (!info) return
    const item: CrmFollowUpItem = {
      contattoId,
      nome: info.nome,
      cognome: info.cognome,
      prossima_data: date,
    }
    if (date < todayStr) { crmScaduti++; crmItems.push(item) }
    else if (date === todayStr) { crmOggi++; crmItems.push(item) }
    else { crmSettimana++; crmItems.push(item) }
  })
  // Ordinati: scaduti prima, poi oggi, poi settimana
  crmItems.sort((a, b) => a.prossima_data.localeCompare(b.prossima_data))

  // ── Risposta ──────────────────────────────────────────────────────────────
  const payload: DashboardLiveData = {
    ts: new Date().toISOString(),
    magazzino: {
      sottoSoglia: sottoSoglia.length,
      items: sottoSoglia.slice(0, MAX_ITEMS),
    },
    ordini: {
      aperti: ordiniProcessed.length,
      stantii: stantii.length,
      items: ordiniProcessed.slice(0, MAX_ITEMS),
    },
    adempimenti: {
      scaduti:    adScaduti.length,
      inScadenza: adInScadenza.length,
      items: adempimentiProcessed.slice(0, MAX_ITEMS),
    },
    tasks: {
      urgentiAperti: tasksUrgenti.length,
      scadutiAperti: tasksScaduti.length,
      items: tasksPreview,
    },
    attrezzature: {
      entro30gg: attrezzatureProcessed.length,
      items: attrezzatureProcessed.slice(0, MAX_ITEMS),
    },
    crmFollowUp: {
      scaduti:  crmScaduti,
      oggi:     crmOggi,
      settimana: crmSettimana,
      items: crmItems.slice(0, MAX_ITEMS),
    },
  }

  return NextResponse.json(payload, {
    headers: {
      // Short cache: fresh data on ogni navigazione, ma evita fetch doppi in dev
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    },
  })
}
