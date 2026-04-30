'use client'

import { useEffect, useState } from 'react'
import { Menu, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import ChatWidget from '@/components/AI/ChatWidget'
import NotificheBell from '@/components/Notifiche/NotificheBell'
import NotifichePanel from '@/components/Notifiche/NotifichePanel'
import { NotificheProvider } from '@/components/Notifiche/NotificheProvider'
import SearchModal from './SearchModal'
import BottomNav from './BottomNav'
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
  const [searchOpen, setSearchOpen] = useState(false)
  const isAdmin = profilo.ruolo === 'admin'

  // Blocca scroll body quando la sidebar mobile è aperta e chiudila con ESC
  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [sidebarOpen])

  // Cmd+K / Ctrl+K apre la ricerca globale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <NotificheProvider>
      <div className="flex overflow-hidden h-screen-safe" style={{ background: '#2C2018' }}>
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:relative md:z-auto transition-transform duration-300 ease-in-out flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar
            profilo={profilo}
            alertCount={alertCount}
            tasksCount={tasksCount}
            onClose={() => setSidebarOpen(false)}
            onSearchOpen={() => setSearchOpen(true)}
          />
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Mobile header */}
          <div
            className="md:hidden flex items-center gap-2 flex-shrink-0 pt-safe"
            style={{
              background: '#221A12',
              borderBottom: '1px solid #4A3B2C',
              height: 'calc(3.5rem + env(safe-area-inset-top))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left))',
              paddingRight: 'max(1rem, env(safe-area-inset-right))',
            }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-1 transition-colors rounded"
              style={{ color: '#A0907E', minWidth: 44, minHeight: 44 }}
              aria-label="Apri menu"
            >
              <Menu size={22} />
            </button>
            <span
              className="flex-1 text-sm tracking-[0.3em] font-light"
              style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', color: '#F2EDE4' }}
            >
              RIDENTIUM
            </span>
            {/* Ricerca su mobile */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 transition-colors rounded"
              style={{ color: '#A0907E', minWidth: 44, minHeight: 44 }}
              aria-label="Cerca"
            >
              <Search size={18} />
            </button>
            <NotificheBell isAdmin={isAdmin} />
          </div>

          <main
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
            }}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-24 md:pb-8">
              {children}
            </div>
          </main>
        </div>

        <BottomNav isAdmin={isAdmin} onSearchOpen={() => setSearchOpen(true)} alertCount={alertCount} tasksCount={tasksCount} />
        <ChatWidget userName={userName} userRole={userRole} alertCount={alertCount} tasksCount={tasksCount} />
        <PushInit />
        <NotifichePanel isAdmin={isAdmin} />
        <SearchModal isAdmin={isAdmin} open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </NotificheProvider>
  )
}
