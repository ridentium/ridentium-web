import NotificheView from '@/components/Notifiche/NotificheView'

export const metadata = { title: 'Notifiche — RIDENTIUM' }

export default function StaffNotifichePage() {
  return <NotificheView isAdmin={false} />
}
