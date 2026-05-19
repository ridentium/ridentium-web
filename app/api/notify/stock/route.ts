import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notify/stock
 * Check inventory levels and send push notifications for items below threshold.
 *
 * Accepts either:
 *  (a) an authenticated admin/manager session, OR
 *  (b) a server-to-server call with the x-notify-secret header (for cron/internal use).
 */
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-notify-secret')
    const secretOk = !!process.env.NOTIFY_SECRET && secret === process.env.NOTIFY_SECRET

    if (!secretOk) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { data: profilo } = await supabase
        .from('profili').select('ruolo').eq('id', user.id).single()
      if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const adminDb = createAdminClient()

    // Fetch items below minimum threshold — escludi prodotti con alert silenziato
    const { data: items } = await adminDb
      .from('magazzino')
      .select('id, prodotto, quantita, soglia_minima, categoria, alert_silenziato, priorita')

    if (!items) return NextResponse.json({ ok: true, alerts: 0 })

    const below   = items.filter((i: any) => i.quantita < i.soglia_minima && !i.alert_silenziato)
    const critici = below.filter((i: any) => i.priorita === 'critica')

    if (below.length === 0) {
      return NextResponse.json({ ok: true, alerts: 0 })
    }

    // Check if notification type is enabled
    const { data: setting } = await adminDb
      .from('notification_settings')
      .select('abilitata')
      .eq('tipo', 'stock_minimo')
      .maybeSingle()

    if (setting && !setting.abilitata) {
      return NextResponse.json({ ok: true, alerts: below.length, skipped: 'disabled' })
    }

    // Critici in cima al corpo notifica, poi gli altri
    const hasCritici = critici.length > 0
    const preview = [
      ...critici.slice(0, hasCritici ? 2 : 0),
      ...below.filter((i: any) => i.priorita !== 'critica').slice(0, hasCritici ? 1 : 3),
    ]
    const names = preview.map((i: any) => i.prodotto).join(', ')
    const extra = below.length > preview.length ? ` e altri ${below.length - preview.length}` : ''

    const notifyPayload = {
      tipo: 'stock_minimo',
      title: hasCritici ? `🔴 Scorte critiche in esaurimento` : `⚠️ Scorte sotto soglia`,
      body: `${below.length} prodott${below.length === 1 ? 'o' : 'i'} in esaurimento: ${names}${extra}`,
      url: '/admin/magazzino',
      tag: 'stock-alert',
      requireInteraction: true,
    }

    // Call the notify endpoint server-to-server
    // Guard: se NOTIFY_SECRET non e configurata, la chiamata fallirebbe con 403 silenzioso
    const notifySecret = process.env.NOTIFY_SECRET
    if (!notifySecret) {
      console.error('[notify/stock] NOTIFY_SECRET non configurata — notifiche push scorte non inviate')
      return NextResponse.json({ ok: true, alerts: below.length, reason: 'notify_secret_missing' })
    }
    const baseUrl = req.nextUrl.origin
    const res = await fetch(`${baseUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notify-secret': notifySecret,
      },
      body: JSON.stringify(notifyPayload),
    })

    const result = await res.json()

    return NextResponse.json({ ok: true, alerts: below.length, ...result })
  } catch (err: any) {
    console.error('Stock check error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
