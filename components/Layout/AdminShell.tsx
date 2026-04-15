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
    <div className="flex h-screen overflow-hidden" style={{ background: '#E5DDD2' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — resta scura */}
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

        {/* Top bar mobile — avorio/bianco */}
        <div
          className="md:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0"
          style={{ background: '#F7F4EF', borderBottom: '1px solid #D2C6B6' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 transition-colors rounded"
            style={{ color: '#8C7D6C' }}
            aria-label="Apri menu"
          >
            <Menu size={20} />
          </button>
          <span
            className="text-sm tracking-[0.3em] font-light"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#1A1714' }}
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

      {/* Lina — panel scuro su sfondo chiaro, ottimo contrasto */}
      <ChatWidget
        userName={userName}
        userRole={userRole}
        alertCount={alertCount}
        tasksCount={tasksCount}
      />
    </div>
  )
}
