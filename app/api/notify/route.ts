import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

// Configure VAPID
webpush.setVapidDetails(
  'mailto:admin@ridentium.it',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

interface NotifyPayload {
  tipo: string           // e.g. 'stock_minimo', 'task_assegnata', 'ricorrente_scaduta'
  ruoli?: string[]       // which roles to notify, defaults to from notification_settings
  user_ids?: string[]    // optionally target specific users
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

// POST /api/notify — internal endpoint to send push notifications
// Called server-side from other routes or cron jobs
export async function POST(req: NextRequest) {
  try {
    // Verify this is an internal call with a secret header
    const secret = req.headers.get('x-notify-secret')
    if (secret !== process.env.NOTIFY_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload: NotifyPayload = await req.json()
    const adminDb = createAdminClient()

    // Check if this notification type is enabled
    const { data: setting } = await adminDb
      .from('notification_settings')
      .select('abilitata, ruoli_destinatari')
      .eq('tipo', payload.tipo)
      .single()

    if (setting && !setting.abilitata) {
      return NextResponse.json({ ok: true, skipped: 'disabled' })
    }

    const targetRuoli: string[] = payload.ruoli ?? setting?.ruoli_destinatari ?? ['admin']

    // Get subscriptions for target roles (or specific users)
    let query = adminDb.from('push_subscriptions').select('*')

    if (payload.user_ids && payload.user_ids.length > 0) {
      query = query.in('user_id', payload.user_ids)
    } else {
      query = query.in('ruolo', targetRuoli)
    }

    const { data: subscriptions } = await query

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const notifPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      tag: payload.tag || payload.tipo,
      requireInteraction: payload.requireInteraction ?? false,
    })

    let sent = 0
    let failed = 0
    const toDelete: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notifPayload,
          { TTL: 86400 }
        )
        sent++
      } catch (err: any) {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(sub.endpoint)
        }
        failed++
      }
    }

    // Clean up expired subscriptions
    if (toDelete.length > 0) {
      await adminDb
        .from('push_subscriptions')
        .delete()
        .in('endpoint', toDelete)
    }

    return NextResponse.json({ ok: true, sent, failed })
  } catch (err: any) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
