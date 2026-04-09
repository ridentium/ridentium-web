import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/notify/stock
 * Check inventory levels and send push notifications for items below threshold.
 * Called from:
 * - Admin layout background check
 * - After magazzino quantity updates
 * - (future) Vercel Cron
 */
export async function GET(req: NextRequest) {
  try {
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
      .single()

    if (setting && !setting.abilitata) {
      return NextResponse.json({ ok: true, alerts: below.length, skipped: 'disabled' })
    }

    // Avoid spamming — only notify if there's a "new" alert (simplified: just send)
    // A more advanced implementation would track last-notified time per item
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

    // Call the notify endpoint
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
