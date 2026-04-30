'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, CheckSquare, Package, Search } from 'lucide-react'

interface BottomNavProps {
  isAdmin: boolean
  onSearchOpen: () => void
}

export default function BottomNav({ isAdmin, onSearchOpen }: BottomNavProps) {
  const pathname = usePathname()
  const base = isAdmin ? '/admin' : '/staff'

  const tabs = [
    { href: base, label: 'Home', icon: LayoutDashboard, exact: true },
    { href: `${base}/agenda`, label: 'Agenda', icon: CalendarDays },
    { href: `${base}/tasks`, label: 'Task', icon: CheckSquare },
    { href: `${base}/magazzino`, label: 'Magazzino', icon: Package },
  ]

  function isActive(href: string, exact: boolean = false) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
      style={{
        background: '#1A1208',
        borderTop: '1px solid rgba(74,59,44,0.6)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors"
            style={{ color: active ? '#C9A96E' : 'rgba(160,144,126,0.6)', minHeight: 56 }}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.05em', fontWeight: active ? 500 : 400 }}>
              {label}
            </span>
          </Link>
        )
      })}

      <button
        onClick={onSearchOpen}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors"
        style={{ color: 'rgba(160,144,126,0.6)', minHeight: 56 }}
        aria-label="Cerca"
      >
        <Search size={20} strokeWidth={1.5} />
        <span style={{ fontSize: 10, letterSpacing: '0.05em' }}>Cerca</span>
      </button>
    </nav>
  )
}
