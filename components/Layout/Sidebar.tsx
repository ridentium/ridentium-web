'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { cn, roleLabel, roleColor } from '@/lib/utils'
import {
  LayoutDashboard, Package, CheckSquare, BookOpen,
  Users, LogOut, ChevronRight, AlertTriangle,
  RefreshCw, Phone, ClipboardList, Settings
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { href: '/admin',              label: 'Panoramica',        icon: LayoutDashboard },
  { href: '/admin/magazzino',    label: 'Magazzino',         icon: Package },
  { href: '/admin/tasks',        label: 'Task',              icon: CheckSquare },
  { href: '/admin/ricorrenti',   label: 'Azioni Ricorrenti', icon: RefreshCw },
  { href: '/admin/sop',          label: 'SOP',               icon: BookOpen },
  { href: '/admin/staff',        label: 'Staff',             icon: Users },
  { href: '/admin/fornitori',    label: 'Fornitori',         icon: Phone },
  { href: '/admin/registro',     label: 'Registro',          icon: ClipboardList },
  { href: '/admin/impostazioni', label: 'Impostazioni',      icon: Settings },
]

const staffNav: NavItem[] = [
  { href: '/staff',              label: 'Home',              icon: LayoutDashboard },
  { href: '/staff/magazzino',    label: 'Magazzino',         icon: Package },
  { href: '/staff/tasks',        label: 'I miei task',       icon: CheckSquare },
  { href: '/staff/ricorrenti',   label: 'Azioni Ricorrenti', icon: RefreshCw },
  { href: '/staff/sop',          label: 'Protocolli',        icon: BookOpen },
]

interface SidebarProps {
  profilo: UserProfile
  alertCount?: number
}

export default function Sidebar({ profilo, alertCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = profilo.ruolo === 'admin'
  const nav = isAdmin ? adminNav : staffNav

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen bg-obsidian border-r border-obsidian-light flex flex-col">

      {/* Brand */}
      <div className="px-6 py-7 border-b border-obsidian-light">
        <h1 className="font-serif text-xl text-cream tracking-[0.2em] font-light">
          RIDENTIUM
        </h1>
        <p className="text-stone/60 text-[10px] tracking-[0.3em] uppercase mt-0.5">
          {isAdmin ? 'Admin' : 'Staff'}
        </p>
      </div>

      {/* Alert banner se ci sono prodotti sotto soglia */}
      {alertCount > 0 && (
        <Link href={isAdmin ? '/admin/magazzino' : '/staff/magazzino'}
              className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded bg-alert/10
                         border border-alert/20 text-red-400 text-xs hover:bg-alert/15 transition-colors">
          <AlertTriangle size={12} />
          <span>{alertCount} prodott{alertCount === 1 ? 'o' : 'i'} sotto soglia</span>
          <ChevronRight size={10} className="ml-auto" />
        </Link>
      )}

      {/* Navigazione */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && href !== '/staff' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
                  className={cn('nav-item', active && 'active')}>
              <Icon size={15} className={active ? 'text-gold' : ''} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Profilo utente */}
      <div className="border-t border-obsidian-light px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30
                          flex items-center justify-center text-gold text-xs font-medium">
            {profilo.nome[0]}{profilo.cognome[0]}
          </div>
          <div className="min-w-0">
            <p className="text-cream text-sm font-medium truncate">
              {profilo.nome} {profilo.cognome}
            </p>
            <p className={cn('text-xs', roleColor(profilo.ruolo))}>
              {roleLabel(profilo.ruolo)}
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
                className="btn-ghost w-full flex items-center gap-2 text-stone/60 hover:text-red-400">
          <LogOut size={13} />
          Esci
        </button>
      </div>
    </aside>
  )
}
