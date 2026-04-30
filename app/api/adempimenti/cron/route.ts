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

  return NextResponse.json({ sent, checked: adempimenti.length })
}
