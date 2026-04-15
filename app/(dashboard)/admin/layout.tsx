import { ReactNode } from 'react'
import Sidebar from '@/components/Layout/Sidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-obsidian">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
