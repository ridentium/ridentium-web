import NotificheView from '@/components/Notifiche/NotificheView'

export const metadata = { title: 'Notifiche — RIDENTIUM' }

export default function AdminNotifichePage() {
  return <NotificheView isAdmin={true} />
}
