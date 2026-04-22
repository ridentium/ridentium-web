import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

// VAPID viene impostato per-request (lazy) — se le env mancano al build
// time web-push lancia "No key set vapidDetails.publicKey".
function configureVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@ridentium.it',
    pub,
    priv,
  )
  return true
}

/**
 * POST /api/notify/task
 * Called after a task is created/reassigned to notify the assignee.
 * Body: { userId: string, taskId: string, titolo: string, priorita?: string }
 *
 * Accepts either:
 *  (a) an authenticated admin/manager session cookie, OR
 *  (b) a server-to-server call with the x-notify-secret header.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth: either valid NOTIFY_SECRET header, or an admin/manager user session
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

    if (!configureVapid()) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'vapid_missing' })
    }

    const { userId, taskId, titolo, priorita } = await req.json()
    if (!userId || !titolo) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    // Check global notification type setting
    const { data: setting } = await adminDb
      .from('notification_settings')
      .select('abilitata')
      .eq('tipo', 'task_assegnata')
      .maybeSingle()

    if (setting && !setting.abilitata) {
      return NextResponse.json({ ok: true, skipped: 'global_disabled' })
    }

    // Check user-level preference (default: enabled if no row or table missing)
    try {
      const { data: userPref } = await adminDb
        .from('user_notification_prefs')
        .select('abilitata')
        .eq('user_id', userId)
        .eq('tipo', 'task_assegnata')
        .maybeSingle()
      if (userPref && !userPref.abilitata) {
        return NextResponse.json({ ok: true, skipped: 'user_disabled' })
      }
    } catch {
      // user_notification_prefs may not exist yet — treat as enabled.
    }

    // Get the user's push subscriptions
    const { data: subscriptions } = await adminDb
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'no_subscription' })
    }

    const prioritaEmoji = priorita === 'alta' ? '🔴' : priorita === 'media' ? '🟡' : '⚪'
    const notifPayload = JSON.stringify({
      title: 'Nuovo task assegnato',
      body: `${prioritaEmoji} ${titolo}`,
      url: '/staff/tasks',
      tag: `task-${taskId}`,
      requireInteraction: priorita === 'alta',
    })

    let sent = 0
    const toDelete: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notifPayload,
          { TTL: 86400 }
        )
        sent++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(sub.endpoint)
        }
      }
    }

    if (toDelete.length > 0) {
      await adminDb.from('push_subscriptions').delete().in('endpoint', toDelete)
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err: any) {
    console.error('Task notify error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
