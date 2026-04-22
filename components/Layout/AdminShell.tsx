'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import ChatWidget from '@/components/AI/ChatWidget'
import NotificheBell from '@/components/Notifiche/NotificheBell'
import NotifichePanel from '@/components/Notifiche/NotifichePanel'
import { NotificheProvider } from '@/components/Notifiche/NotificheProvider'
import { UserProfile } from '@/types'
import PushInit from '@/components/Push/PushInit'

interface Props {
  children: React.ReactNode
  profilo: UserProfile
  alertCount: number
  tasksCount: number
  userName: string
  userRole: string
}

export default function AdminShell({ children, profilo, alertCount, tasksCount, userName, userRole }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = profilo.ruolo === 'admin'

  return (
    <NotificheProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: '#2C2018' }}>
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:relative md:z-auto transition-transform duration-300 ease-in-out flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar profilo={profilo} alertCount={alertCount} tasksCount={tasksCount} onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Mobile header */}
          <div
            className="md:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0"
            style={{ background: '#221A12', borderBottom: '1px solid #4A3B2C' }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-1 transition-colors rounded"
              style={{ color: '#A0907E' }}
              aria-label="Apri menu"
            >
              <Menu size={20} />
            </button>
            <span
              className="flex-1 text-sm tracking-[0.3em] font-light"
              style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', color: '#F2EDE4' }}
            >
              RIDENTIUM
            </span>
            <NotificheBell isAdmin={isAdmin} />
          </div>

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</div>
          </main>
        </div>

        <ChatWidget userName={userName} userRole={userRole} alertCount={alertCount} tasksCount={tasksCount} />
        <PushInit />
        <NotifichePanel isAdmin={isAdmin} />
      </div>
    </NotificheProvider>
  )
}
