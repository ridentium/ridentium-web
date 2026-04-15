'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { cn, roleLabel, roleColor } from '@/lib/utils'
import {
  LayoutDashboard, Package, CheckSquare, BookOpen,
  Users, LogOut, ChevronRight, AlertTriangle,
  ShoppingCart, UserCircle2, RefreshCw, Activity,
  Sparkles, Building2, X
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  highlight?: boolean
}

const adminNav: NavItem[] = [
  { href: '/admin',             label: 'Panoramica',    icon: LayoutDashboard },
  { href: '/admin/magazzino',   label: 'Magazzino',     icon: Package },
  { href: '/admin/ordini',      label: 'Ordini',        icon: ShoppingCart },
  { href: '/admin/fornitori',   label: 'Fornitori',     icon: Building2 },
  { href: '/admin/tasks',       label: 'Task',          icon: CheckSquare },
  { href: '/admin/ricorrenti',  label: 'Ricorrenti',    icon: RefreshCw },
  { href: '/admin/crm',         label: 'CRM',           icon: UserCircle2 },
  { href: '/admin/staff',       label: 'Staff',         icon: Users },
  { href: '/admin/sop',         label: 'Protocolli',    icon: BookOpen },
  { href: '/admin/registro',    label: 'Registro',      icon: Activity },
  { href: '/admin/ai',          label: 'Lina AI',       icon: Sparkles, highlight: true },
]

const staffNav: NavItem[] = [
  { href: '/staff',             label: 'Home',          icon: LayoutDashboard },
  { href: '/staff/magazzino',   label: 'Magazzino',     icon: Package },
  { href: '/staff/tasks',       label: 'I miei task',   icon: CheckSquare },
  { href: '/staff/sop',         label: 'Protocolli',    icon: BookOpen },
]

interface SidebarProps {
  profilo: UserProfile
  alertCount?: number
  onClose?: () => void
}

export default function Sidebar({ profilo, alertCount = 0, onClose }: SidebarProps) {
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

  function handleNavClick() {
    // Chiude la sidebar su mobile dopo aver cliccato un link
    onClose?.()
  }

  return (
    <aside className="w-56 h-full bg-obsidian border-r border-obsidian-light flex flex-col">

      {/* Brand + pulsante chiudi (solo mobile) */}
      <div className="px-6 py-6 border-b border-obsidian-light flex items-start justify-between">
        <div>
          <h1 className="font-serif text-xl text-cream tracking-[0.2em] font-light">
            RIDENTIUM
          </h1>
          <p className="text-stone/60 text-[10px] tracking-[0.3em] uppercase mt-0.5">
            {isAdmin ? 'Admin' : 'Staff'}
          </p>
        </div>
        {/* Bottone X visibile solo su mobile */}
        <button
          onClick={onClose}
          className="md:hidden p-1 text-stone hover:text-cream transition-colors -mr-1"
          aria-label="Chiudi menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Alert scorte */}
      {alertCount > 0 && (
        <Link
          href={isAdmin ? '/admin/magazzino' : '/staff/magazzino'}
          onClick={handleNavClick}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded bg-alert/10
                     border border-alert/20 text-red-400 text-xs hover:bg-alert/15 transition-colors"
        >
          <AlertTriangle size={12} />
          <span>{alertCount} prodott{alertCount === 1 ? 'o' : 'i'} sotto soglia</span>
          <ChevronRight size={10} className="ml-auto" />
        </Link>
      )}

      {/* Navigazione — scorribile se troppi item */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== '/admin' && href !== '/staff' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              className={cn(
                'nav-item',
                active && 'active',
                highlight && !active && 'text-gold/70 hover:text-gold',
              )}
            >
              <Icon size={15} className={active ? 'text-gold' : highlight ? 'text-gold/60' : ''} />
              <span>{label}</span>
              {highlight && !active && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-sm bg-gold/10 text-gold/70 border border-gold/20">
                  AI
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Profilo + logout */}
      <div className="border-t border-obsidian-light px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30
                          flex items-center justify-center text-gold text-xs font-medium flex-shrink-0">
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
        <button
          onClick={handleLogout}
          className="btn-ghost w-full flex items-center gap-2 text-stone/60 hover:text-red-400"
        >
          <LogOut size={13} />
          Esci
        </button>
      </div>
    </aside>
  )
}
