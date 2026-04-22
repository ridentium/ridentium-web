import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    // Fetch items below minimum threshold
    const { data: items } = await adminDb
      .from('magazzino')
      .select('id, prodotto, quantita, soglia_minima, categoria')

    if (!items) return NextResponse.json({ ok: true, alerts: 0 })

    const below = items.filter((i: any) => i.quantita < i.soglia_minima)

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

    const names = below.slice(0, 3).map((i: any) => i.prodotto).join(', ')
    const extra = below.length > 3 ? ` e altri ${below.length - 3}` : ''

    const notifyPayload = {
      tipo: 'stock_minimo',
      title: `⚠️ Scorte sotto soglia`,
      body: `${below.length} prodott${below.length === 1 ? 'o' : 'i'} in esaurimento: ${names}${extra}`,
      url: '/admin/magazzino',
      tag: 'stock-alert',
      requireInteraction: true,
    }

    // Call the notify endpoint server-to-server
    const baseUrl = req.nextUrl.origin
    const res = await fetch(`${baseUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notify-secret': process.env.NOTIFY_SECRET || '',
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
