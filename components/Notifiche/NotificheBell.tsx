'use client'

import { Bell } from 'lucide-react'
import { useNotifiche } from './NotificheProvider'

/**
 * Trigger della campanella. Puo' essere montato piu' volte (es. desktop sidebar + mobile header):
 * lo stato `open` e il conteggio unread vivono nel NotificheProvider condiviso, percio' ogni trigger
 * e' solo un bottone leggero. Il drawer (vedi `NotifichePanel.tsx`) e' renderizzato una sola volta.
 */
export default function NotificheBell({ isAdmin: _isAdmin }: { isAdmin: boolean }) {
  const { unread, open, setOpen, markAllRead } = useNotifiche()

  function handleToggle() {
    if (open) setOpen(false)
    else {
      setOpen(true)
      void markAllRead()
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="relative p-1.5 rounded transition-colors"
      style={{ color: 'rgba(160,144,126,0.7)' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(160,144,126,0.7)')}
      aria-label={`Notifiche${unread > 0 ? ` (${unread})` : ''}`}
    >
      <Bell size={16} />
      {unread > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full font-bold"
          style={{ background: '#E05545', color: '#fff', fontSize: 9, minWidth: 15, height: 15, padding: '0 3px' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
