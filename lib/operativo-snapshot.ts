import type { createAdminClient } from '@/lib/supabase/admin'
import { getPeriodoKey } from '@/lib/periodo'

// ─── Costanti ─────────────────────────────────────────────────────────────────

const MAX = 5  // max item per sezione nel testo snapshot

// ─── Helper ───────────────────────────────────────────────────────────────────

function ggLabel(gg: number): string {
  if (gg < 0)  return `SCADUTO da ${Math.abs(gg)} gg ⚠`
  if (gg === 0) return 'scade OGGI ⚠'
  if (gg === 1) return 'scade domani'
  return `tra ${gg} gg`
}

// Estrae data array da un PromiseSettledResult Supabase, mai throws
function safeData<T>(r: PromiseSettledResult<unknown>): T[] {
  if (r.status === 'rejected') return []
  const v = r.value as { data?: T[] | null } | null
  return v?.data ?? []
}

// ─── Snapshot operativo testuale ──────────────────────────────────────────────
//
// Genera un testo compatto con lo stato operativo reale dello studio.
// Iniettato nel system prompt di Lina — solo lettura, nessuna scrittura DB.
// Ogni sezione è fault-tolerant: se la query fallisce, viene saltata con nota.

export async function buildOperativoSnapshot(
  db: ReturnType<typeof createAdminClient>,
): Promise<string> {

  const oggi     = new Date()
  const todayStr = oggi.toISOString().slice(0, 10)
  const in7Str   = new Date(oggi.getTime() +  7 * 86_400_000).toISOString().slice(0, 10)
  const in30Str  = new Date(oggi.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  const m30Str   = new Date(oggi.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)

  // Lunedì di questa settimana — per KPI task%
  const dow    = oggi.getDay()
  const lunedi = new Date(oggi)
  lunedi.setDate(oggi.getDate() - (dow === 0 ? 6 : dow - 1))
  lunedi.setHours(0, 0, 0, 0)
  const lunediISO = lunedi.toISOString()

  // ── 8 query in parallelo — allSettled = fault-tolerant per sezione ────────
  const [magR, ordR, adR, tskR, attrR, crmR, tskCountR, ricR] = await Promise.allSettled([
    db.from('magazzino')
      .select('prodotto, quantita, soglia_minima'),                                         // 0

    db.from('ordini')
      .select('fornitore_nome, stato, data_invio')
      .in('stato', ['inviato', 'confermato_fornitore', 'in_consegna'])
      .order('data_invio', { ascending: true }),                                            // 1

    db.from('adempimenti')
      .select('titolo, prossima_scadenza')
      .eq('attivo', true)
      .not('prossima_scadenza', 'is', null)
      .lte('prossima_scadenza', in7Str)
      .order('prossima_scadenza', { ascending: true }),                                     // 2

    db.from('tasks')
      .select('titolo, priorita, scadenza')
      .neq('stato', 'completato')
      .is('deleted_at', null)
      .order('scadenza', { ascending: true, nullsFirst: false }),                           // 3

    db.from('attrezzature')
      .select('nome, data_prossima_manutenzione')
      .not('data_prossima_manutenzione', 'is', null)
      .lte('data_prossima_manutenzione', in30Str)
      .order('data_prossima_manutenzione', { ascending: true }),                            // 4

    db.from('crm_interazioni')
      .select('crm_contatto_id, prossima_data')
      .not('prossima_data', 'is', null)
      .gte('prossima_data', m30Str)
      .lte('prossima_data', in7Str)
      .order('prossima_data', { ascending: true }),                                         // 5

    db.from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('stato', 'completato')
      .is('deleted_at', null)
      .gte('updated_at', lunediISO),                                                        // 6 — count only

    db.from('ricorrenti')
      .select('frequenza, completamenti')
      .eq('attiva', true),                                                                  // 7
  ])

  // ── Costruzione testo ──────────────────────────────────────────────────────

  const lines: string[] = []
  const ora = oggi.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  lines.push(`SNAPSHOT OPERATIVO STUDIO — ${ora}`)
  lines.push('')

  // 1. Magazzino
  {
    type MagRow = { prodotto: string; quantita: number; soglia_minima: number }
    const mag   = safeData<MagRow>(magR)
    if (magR.status === 'rejected') {
      lines.push('MAGAZZINO: dati non disponibili')
    } else {
      const sotto = mag.filter(i => i.quantita < i.soglia_minima)
      lines.push(`MAGAZZINO: ${sotto.length} prodott${sotto.length === 1 ? 'o' : 'i'} sotto soglia`)
      sotto.slice(0, MAX).forEach(i => {
        const note = i.quantita === 0 ? ' ⚠ ESAURITO' : ''
        lines.push(`  • ${i.prodotto}: ${i.quantita} (min ${i.soglia_minima})${note}`)
      })
      if (sotto.length > MAX) lines.push(`  [+ ${sotto.length - MAX} altri]`)
      if (sotto.length === 0) lines.push('  • Tutto in ordine ✓')
    }
  }

  lines.push('')

  // 2. Ordini
  {
    type OrdRow = { fornitore_nome: string; stato: string; data_invio: string }
    const ord   = safeData<OrdRow>(ordR)
    if (ordR.status === 'rejected') {
      lines.push('ORDINI: dati non disponibili')
    } else {
      const stantii = ord.filter(o => {
        if (o.stato !== 'inviato') return false
        const gg = Math.floor((oggi.getTime() - new Date(o.data_invio + 'T00:00:00').getTime()) / 86_400_000)
        return gg > 3
      })
      lines.push(`ORDINI: ${ord.length} apert${ord.length === 1 ? 'o' : 'i'}, ${stantii.length} stant${stantii.length === 1 ? 'io' : 'i'} (+3gg)`)
      ord.slice(0, MAX).forEach(o => {
        const gg   = Math.floor((oggi.getTime() - new Date(o.data_invio + 'T00:00:00').getTime()) / 86_400_000)
        const flag = stantii.some(s => s.fornitore_nome === o.fornitore_nome && s.data_invio === o.data_invio) ? ' ⚠' : ''
        lines.push(`  • ${o.fornitore_nome} — ${o.stato.replace(/_/g, ' ')} (${gg} gg fa)${flag}`)
      })
      if (ord.length > MAX) lines.push(`  [+ ${ord.length - MAX} altri]`)
      if (ord.length === 0) lines.push('  • Nessun ordine in attesa ✓')
    }
  }

  lines.push('')

  // 3. Adempimenti
  {
    type AdRow = { titolo: string; prossima_scadenza: string }
    const ad   = safeData<AdRow>(adR)
    if (adR.status === 'rejected') {
      lines.push('ADEMPIMENTI: dati non disponibili')
    } else {
      const scaduti = ad.filter(a => a.prossima_scadenza < todayStr)
      const inScad  = ad.filter(a => a.prossima_scadenza >= todayStr)
      lines.push(`ADEMPIMENTI: ${scaduti.length} scadut${scaduti.length === 1 ? 'o' : 'i'}, ${inScad.length} entro 7gg`)
      ad.slice(0, MAX).forEach(a => {
        const d  = new Date(a.prossima_scadenza + 'T00:00:00')
        const t0 = new Date(todayStr + 'T00:00:00')
        const gg = Math.round((d.getTime() - t0.getTime()) / 86_400_000)
        lines.push(`  • ${a.titolo}: ${ggLabel(gg)}`)
      })
      if (ad.length > MAX) lines.push(`  [+ ${ad.length - MAX} altri]`)
      if (ad.length === 0) lines.push('  • Tutto in regola ✓')
    }
  }

  lines.push('')

  // 4. Task urgenti/scaduti
  {
    type TskRow = { titolo: string; priorita: string; scadenza: string | null }
    const tsk   = safeData<TskRow>(tskR)
    if (tskR.status === 'rejected') {
      lines.push('TASK: dati non disponibili')
    } else {
      const urgenti = tsk.filter(t => t.priorita === 'alta')
      const scaduti = tsk.filter(t => t.scadenza && t.scadenza < todayStr)
      lines.push(`TASK: ${urgenti.length} alta priorità apert${urgenti.length === 1 ? 'o' : 'i'}, ${scaduti.length} scadut${scaduti.length === 1 ? 'o' : 'i'}`)

      // Preview: scaduti prima, poi urgenti non duplicati
      const seen    = new Set<string>()
      const preview: TskRow[] = []
      for (const t of [...scaduti, ...urgenti]) {
        if (!seen.has(t.titolo) && preview.length < MAX) {
          seen.add(t.titolo)
          preview.push(t)
        }
      }
      preview.forEach(t => {
        const flag = t.scadenza && t.scadenza < todayStr ? ' ⚠ SCADUTO' : ''
        lines.push(`  • ${t.titolo}${flag}`)
      })
      const extra = urgenti.length + scaduti.length - preview.length
      if (extra > 0) lines.push(`  [+ ${extra} altri]`)
      if (urgenti.length === 0 && scaduti.length === 0) lines.push('  • Nessun task urgente ✓')
    }
  }

  lines.push('')

  // 5. Attrezzature
  {
    type AttrRow = { nome: string; data_prossima_manutenzione: string }
    const attr   = safeData<AttrRow>(attrR)
    if (attrR.status === 'rejected') {
      lines.push('ATTREZZATURE: dati non disponibili')
    } else {
      const scadute = attr.filter(a => a.data_prossima_manutenzione < todayStr)
      lines.push(`ATTREZZATURE: ${attr.length} manutenzioni entro 30gg, ${scadute.length} scadute`)
      attr.slice(0, MAX).forEach(a => {
        const d  = new Date(a.data_prossima_manutenzione + 'T00:00:00')
        const t0 = new Date(todayStr + 'T00:00:00')
        const gg = Math.round((d.getTime() - t0.getTime()) / 86_400_000)
        lines.push(`  • ${a.nome}: ${ggLabel(gg)}`)
      })
      if (attr.length > MAX) lines.push(`  [+ ${attr.length - MAX} altri]`)
      if (attr.length === 0) lines.push('  • Nessuna manutenzione imminente ✓')
    }
  }

  lines.push('')

  // 6. CRM Follow-up
  {
    type CrmRow = { crm_contatto_id: string; prossima_data: string }
    const crm   = safeData<CrmRow>(crmR)
    if (crmR.status === 'rejected') {
      lines.push('CRM FOLLOW-UP: dati non disponibili')
    } else {
      // Dedup per contatto — un contatto può avere più interazioni pendenti
      const seen    = new Set<string>()
      const deduped: CrmRow[] = []
      for (const i of crm) {
        if (!seen.has(i.crm_contatto_id)) {
          seen.add(i.crm_contatto_id)
          deduped.push(i)
        }
      }
      const scaduti = deduped.filter(i => i.prossima_data < todayStr).length
      const oggiN   = deduped.filter(i => i.prossima_data === todayStr).length
      const sett    = deduped.filter(i => i.prossima_data > todayStr && i.prossima_data <= in7Str).length
      lines.push(`CRM FOLLOW-UP: ${deduped.length} contatt${deduped.length === 1 ? 'o' : 'i'} totali`)
      lines.push(`  • ${scaduti} scadut${scaduti === 1 ? 'o' : 'i'}${scaduti > 0 ? ' ⚠' : ''}, ${oggiN} oggi, ${sett} questa settimana`)
      if (deduped.length === 0) lines.push('  • Nessun follow-up pendente ✓')
    }
  }

  lines.push('')

  // 7–8. KPI Settimana
  {
    lines.push('KPI SETTIMANA:')

    // Task % — count query restituisce { count: number | null }
    const completatiSett: number =
      tskCountR.status === 'fulfilled'
        ? (((tskCountR.value as unknown as { count: number | null }).count) ?? 0)
        : 0
    const aperti: number | null =
      tskR.status === 'fulfilled' ? (safeData(tskR).length) : null

    if (aperti !== null) {
      const tot  = completatiSett + aperti
      const perc = tot > 0 ? Math.round((completatiSett / tot) * 100) : 0
      lines.push(`  • Task: ${perc}% completati questa settimana (${completatiSett} chiusi, ${aperti} ancora aperti)`)
    } else {
      lines.push('  • Task: dato non disponibile')
    }

    // Ricorrenti %
    if (ricR.status === 'fulfilled') {
      type RicRow = { frequenza: string; completamenti: { periodoKey: string }[] | null }
      const ric  = safeData<RicRow>(ricR)
      const tot  = ric.length
      const comp = ric.filter(r => {
        const key = getPeriodoKey(r.frequenza)
        return ((r.completamenti ?? []) as { periodoKey: string }[]).some(c => c.periodoKey === key)
      }).length
      const perc = tot > 0 ? Math.round((comp / tot) * 100) : 0
      lines.push(`  • Ricorrenti: ${perc}% completate nel periodo (${comp}/${tot})`)
    } else {
      lines.push('  • Ricorrenti: dato non disponibile')
    }
  }

  return lines.join('\n')
}
