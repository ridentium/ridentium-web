import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotifica } from '@/lib/notifiche'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Vercel cron jobs send this header; protect against unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminDb = createAdminClient()
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)

  const { data: adempimenti } = await adminDb
    .from('adempimenti')
    .select('id, titolo, prossima_scadenza, preavviso_giorni, responsabile_profilo_id')
    .eq('attivo', true)
    .not('prossima_scadenza', 'is', null)

  if (!adempimenti?.length) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0

  for (const a of adempimenti) {
    const scad = new Date(a.prossima_scadenza)
    scad.setHours(0, 0, 0, 0)
    const gg = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000)
    const preavviso = a.preavviso_giorni ?? 30

    // Notify only at: scaduto (gg < 0), oggi (gg === 0), preavviso/2, preavviso
    const shouldNotify = gg < 0 || gg === 0 || gg === Math.round(preavviso / 2) || gg === preavviso

    if (!shouldNotify) continue

    const isScaduto = gg < 0
    const titolo = isScaduto
      ? `⚠ Adempimento scaduto: ${a.titolo}`
      : gg === 0
      ? `Adempimento in scadenza oggi: ${a.titolo}`
      : `Adempimento in scadenza tra ${gg} giorni: ${a.titolo}`

    const corpo = isScaduto
      ? `Scaduto da ${Math.abs(gg)} giorni — intervento richiesto`
      : `Scadenza: ${scad.toLocaleDateString('it-IT')}`

    // Notify responsabile if set, otherwise all admin/manager
    const opts = a.responsabile_profilo_id
      ? { user_ids: [a.responsabile_profilo_id] }
      : { ruoli: ['admin', 'manager'] as string[] }

    await createNotifica({
      ...opts,
      tipo: 'messaggio',
      titolo,
      corpo,
      url: '/admin/adempimenti',
      push: true,
    }).catch(() => {})

    sent++
  }

  // ── Report settimanale del lunedì ─────────────────────────────────────────
  if (oggi.getDay() === 1) {
    const { data: scadutiAll } = await adminDb
      .from('adempimenti')
      .select('id, titolo, prossima_scadenza, preavviso_giorni')
      .eq('attivo', true)
      .not('prossima_scadenza', 'is', null)

    const scadutiCount = (scadutiAll ?? []).filter(a => {
      const scad = new Date(a.prossima_scadenza!)
      scad.setHours(0, 0, 0, 0)
      return Math.ceil((scad.getTime() - oggi.getTime()) / 86400000) < 0
    }).length

    const inScadenzaCount = (scadutiAll ?? []).filter(a => {
      const scad = new Date(a.prossima_scadenza!)
      scad.setHours(0, 0, 0, 0)
      const gg = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000)
      return gg >= 0 && gg <= (a.preavviso_giorni ?? 30)
    }).length

    const { data: tasksOpen } = await adminDb
      .from('tasks')
      .select('id')
      .neq('stato', 'completato')

    const { data: magazzinoAlert } = await adminDb
      .from('magazzino')
      .select('id, quantita, soglia_minima')

    const sottoSogliaCount = (magazzinoAlert ?? []).filter((i: any) => i.quantita < i.soglia_minima).length
    const tasksCount = tasksOpen?.length ?? 0

    const parti: string[] = []
    if (scadutiCount > 0) parti.push(`${scadutiCount} adempiment${scadutiCount === 1 ? 'o scaduto' : 'i scaduti'}`)
    if (inScadenzaCount > 0) parti.push(`${inScadenzaCount} in scadenza`)
    if (tasksCount > 0) parti.push(`${tasksCount} task apert${tasksCount === 1 ? 'o' : 'i'}`)
    if (sottoSogliaCount > 0) parti.push(`${sottoSogliaCount} prodott${sottoSogliaCount === 1 ? 'o' : 'i'} sotto soglia`)

    const corpo = parti.length > 0
      ? `Questa settimana: ${parti.join(', ')}.`
      : 'Tutto in ordine — nessuna urgenza questa settimana.'

    await createNotifica({
      ruoli: ['admin', 'manager'],
      tipo: 'messaggio',
      titolo: '📋 Report settimanale RIDENTIUM',
      corpo,
      url: '/admin',
      push: true,
    }).catch(() => {})
  }

  return NextResponse.json({ sent, checked: adempimenti.length })
}
