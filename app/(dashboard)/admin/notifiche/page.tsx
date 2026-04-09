import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import NotificheAdmin from '@/components/Notifiche/NotificheAdmin'

export default async function NotifichePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()

  const { data: settings } = await adminDb
    .from('notification_settings')
    .select('*')
    .order('tipo')

  const { data: subscriptions } = await adminDb
    .from('push_subscriptions')
    .select('id, user_id, ruolo, created_at, endpoint')
    .order('created_at', { ascending: false })

  return (
    <NotificheAdmin
      settings={settings ?? []}
      subscriptions={subscriptions ?? []}
    />
  )
}
