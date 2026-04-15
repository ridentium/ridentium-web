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
  Sparkles, Building2, X,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  highlight?: boolean
}

// ── Navigazione raggruppata ────────────────────────────────────────────────────

const adminHome: NavItem[] = [
  { href: '/admin', label: 'Panoramica', icon: LayoutDashboard },
]

const adminOperazioni: NavItem[] = [
  { href: '/admin/magazzino',  label: 'Magazzino',  icon: Package     },
  { href: '/admin/ordini',     label: 'Ordini',     icon: ShoppingCart },
  { href: '/admin/fornitori',  label: 'Fornitori',  icon: Building2   },
]

const adminTeam: NavItem[] = [
  { href: '/admin/tasks',      label: 'Task',       icon: CheckSquare },
  { href: '/admin/ricorrenti', label: 'Ricorrenti', icon: RefreshCw   },
  { href: '/admin/crm',        label: 'CRM',        icon: UserCircle2 },
  { href: '/admin/staff',      label: 'Staff',      icon: Users       },
]

const adminSistema: NavItem[] = [
  { href: '/admin/sop',        label: 'Protocolli', icon: BookOpen    },
  { href: '/admin/registro',   label: 'Registro',   icon: Activity    },
]

const adminAI: NavItem[] = [
  { href: '/admin/ai', label: 'Lina AI', icon: Sparkles, highlight: true },
]

const staffNav: NavItem[] = [
  { href: '/staff',            label: 'Home',         icon: LayoutDashboard },
  { href: '/staff/magazzino',  label: 'Magazzino',    icon: Package         },
  { href: '/staff/tasks',      label: 'I miei task',  icon: CheckSquare     },
  { href: '/staff/sop',        label: 'Protocolli',   icon: BookOpen        },
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface SidebarProps {
  profilo: UserProfile
  alertCount?: number
  onClose?: () => void
}

// ── Helper render ──────────────────────────────────────────────────────────────

function NavGroup({ label, items, pathname, onClose }: {
  label?: string
  items: NavItem[]
  pathname: string
  onClose?: () => void
}) {
  return (
    <div>
      {label && (
        <p className="px-3 mb-1 text-[9px] text-stone/40 uppercase tracking-[0.2em] font-medium select-none">
          {label}
        </p>
      )}
      {items.map(({ href, label: itemLabel, icon: Icon, highlight }) => {
        const active = pathname === href || (href !== '/admin' && href !== '/staff' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'nav-item',
              active && 'active',
              highlight && !active && 'text-gold/70 hover:text-gold',
            )}
          >
            <Icon size={15} className={active ? 'text-gold' : highlight ? 'text-gold/60' : ''} />
            <span>{itemLabel}</span>
            {highlight && !active && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-sm bg-gold/10 text-gold/70 border border-gold/20">
                AI
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export default function Sidebar({ profilo, alertCount = 0, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = profilo.ruolo === 'admin'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 h-full bg-obsidian border-r border-obsidian-light flex flex-col">

      {/* Brand */}
      <div className="px-6 py-6 border-b border-obsidian-light flex items-start justify-between">
        <div>
          <h1 className="font-serif text-xl text-cream tracking-[0.2em] font-light">RIDENTIUM</h1>
          <p className="text-stone/50 text-[10px] tracking-[0.3em] uppercase mt-0.5">
            {isAdmin ? 'Admin' : 'Staff'}
          </p>
        </div>
        <button onClick={onClose} className="md:hidden p-1 text-stone hover:text-cream transition-colors -mr-1">
          <X size={16} />
        </button>
      </div>

      {/* Alert scorte */}
      {alertCount > 0 && (
        <Link
          href={isAdmin ? '/admin/magazzino' : '/staff/magazzino'}
          onClick={onClose}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded bg-alert/10 border border-alert/20 text-red-400 text-xs hover:bg-alert/15 transition-colors"
        >
          <AlertTriangle size={12} />
          <span>{alertCount} prodott{alertCount === 1 ? 'o' : 'i'} sotto soglia</span>
          <ChevronRight size={10} className="ml-auto" />
        </Link>
      )}

      {/* Navigazione */}
      {isAdmin ? (
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          <NavGroup items={adminHome}       pathname={pathname} onClose={onClose} />
          <NavGroup label="Operazioni" items={adminOperazioni} pathname={pathname} onClose={onClose} />
          <NavGroup label="Team"       items={adminTeam}       pathname={pathname} onClose={onClose} />
          <NavGroup label="Sistema"    items={adminSistema}    pathname={pathname} onClose={onClose} />
          {/* Lina AI — separata con bordo */}
          <div className="border-t border-obsidian-light/40 pt-3">
            <NavGroup items={adminAI} pathname={pathname} onClose={onClose} />
          </div>
        </nav>
      ) : (
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <NavGroup items={staffNav} pathname={pathname} onClose={onClose} />
        </nav>
      )}

      {/* Profilo + logout */}
      <div className="border-t border-obsidian-light px-4 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-gold text-xs font-medium flex-shrink-0">
            {profilo.nome[0]}{profilo.cognome[0]}
          </div>
          <div className="min-w-0">
            <p className="text-cream text-sm font-medium truncate">{profilo.nome} {profilo.cognome}</p>
            <p className={cn('text-xs', roleColor(profilo.ruolo))}>{roleLabel(profilo.ruolo)}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-ghost w-full flex items-center gap-2 text-stone/60 hover:text-red-400">
          <LogOut size={13} />
          Esci
        </button>
      </div>
    </aside>
  )
}
