import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

function configureVapid(): boolean {
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

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb.from('profili').select('ruolo').eq('id', user.id).single()
  if (profilo?.ruolo !== 'admin') return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })

  if (!configureVapid()) {
    return NextResponse.json({ error: 'VAPID non configurato' }, { status: 500 })
  }

  const { data: subs } = await adminDb
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Nessuna subscription su questo dispositivo' })
  }

  const payload = JSON.stringify({
    title: '✅ RIDENTIUM — Test notifica',
    body: 'Le notifiche push funzionano correttamente.',
    url: '/admin/notifiche',
    tag: 'test-push',
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 }
      )
      sent++
    } catch {
      await adminDb.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }

  return NextResponse.json({ sent, message: sent > 0 ? `Push inviata a ${sent} dispositiv${sent === 1 ? 'o' : 'i'}` : 'Subscription scaduta, rimossa' })
}
