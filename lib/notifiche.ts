import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

export type TipoNotifica = 'magazzino' | 'task' | 'ricorrente' | 'messaggio' | 'crm'

export interface Notifica {
  id: string
  user_id: string
  tipo: TipoNotifica
  titolo: string
  corpo?: string | null
  url?: string | null
  letta: boolean
  created_at: string
  metadata?: Record<string, unknown> | null
}

interface CreateNotificaOpts {
  ruoli?: string[]
  user_ids?: string[]
  tipo: TipoNotifica
  titolo: string
  corpo?: string
  url?: string
  metadata?: Record<string, unknown>
  push?: boolean
}

export async function createNotifica(opts: CreateNotificaOpts) {
  const adminDb = createAdminClient()

  let targetIds: string[] = opts.user_ids ?? []
  if (targetIds.length === 0 && opts.ruoli?.length) {
    const { data } = await adminDb.from('profili').select('id').in('ruolo', opts.ruoli)
    targetIds = (data ?? []).map((p: any) => p.id)
  }
  if (targetIds.length === 0) return { created: 0 }

  const rows = targetIds.map(user_id => ({
    user_id,
    tipo: opts.tipo,
    titolo: opts.titolo,
    corpo: opts.corpo ?? null,
    url: opts.url ?? null,
    metadata: opts.metadata ?? null,
  }))

  const { error } = await adminDb.from('notifiche').insert(rows)
  if (error) { console.error('[notifiche] insert error:', error); return { created: 0 } }

  if (opts.push !== false) {
    try {
      webpush.setVapidDetails(
        'mailto:admin@ridentium.it',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
        process.env.VAPID_PRIVATE_KEY || ''
      )
      const { data: subs } = await adminDb
        .from('push_subscriptions').select('endpoint, p256dh, auth')
        .in('user_id', targetIds)
      if (subs?.length) {
        const payload = JSON.stringify({
          title: opts.titolo,
          body: opts.corpo ?? '',
          url: opts.url ?? '/',
          tag: opts.tipo,
        })
        const expired: string[] = []
        await Promise.allSettled(subs.map(async (s: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload, { TTL: 86400 }
            )
          } catch (e: any) {
            if (e.statusCode === 410 || e.statusCode === 404) expired.push(s.endpoint)
          }
        }))
        if (expired.length) await adminDb.from('push_subscriptions').delete().in('endpoint', expired)
      }
    } catch (e) { console.error('[notifiche] push error:', e) }
  }

  return { created: rows.length }
}
