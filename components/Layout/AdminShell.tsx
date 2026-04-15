'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import ChatWidget from '@/components/AI/ChatWidget'
import { UserProfile } from '@/types'

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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0D0D0B' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 md:relative md:z-auto
          transition-transform duration-300 ease-in-out flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar
          profilo={profilo}
          alertCount={alertCount}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Colonna principale */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Top bar mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-obsidian-light flex-shrink-0 bg-obsidian">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 text-stone hover:text-cream transition-colors rounded"
            aria-label="Apri menu"
          >
            <Menu size={20} />
          </button>
          <span
            className="text-cream text-sm tracking-[0.3em] font-light"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            RIDENTIUM
          </span>
        </div>

        {/* Contenuto */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Lina */}
      <ChatWidget
        userName={userName}
        userRole={userRole}
        alertCount={alertCount}
        tasksCount={tasksCount}
      />
    </div>
  )
}
