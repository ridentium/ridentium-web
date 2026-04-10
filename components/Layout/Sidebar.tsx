'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { cn, roleLabel, roleColor } from '@/lib/utils'
import {
  LayoutDashboard, Package, CheckSquare, BookOpen,
  Users, LogOut, ChevronRight, AlertTriangle,
  RefreshCw, Phone, ClipboardList, Settings, UserCircle,
  ShoppingCart, Menu, X, Bell, Clock, Search,
} from 'lucide-react'
import SearchModal from '@/components/Layout/SearchModal'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { href: '/admin',              label: 'Panoramica',        icon: LayoutDashboard },
  { href: '/admin/magazzino',    label: 'Magazzino',         icon: Package },
  { href: '/admin/ordini',       label: 'Ordini',            icon: ShoppingCart },
  { href: '/admin/tasks',        label: 'Task',              icon: CheckSquare },
  { href: '/admin/ricorrenti',   label: 'Azioni Ricorrenti', icon: RefreshCw },
  { href: '/admin/sop',          label: 'SOP',               icon: BookOpen },
  { href: '/admin/staff',        label: 'Staff',             icon: Users },
  { href: '/admin/fornitori',    label: 'Fornitori',         icon: Phone },
  { href: '/admin/registro',     label: 'Registro',          icon: ClipboardList },
  { href: '/admin/notifiche',    label: 'Notifiche',         icon: Bell },
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
  ordiniAperti?: number
  scadenzaCount?: number
}

export default function Sidebar({ profilo, alertCount = 0, ordiniAperti = 0, scadenzaCount = 0 }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = profilo.ruolo === 'admin'
  const nav = isAdmin ? adminNav : staffNav
  const profiloHref = isAdmin ? '/admin/profilo' : '/staff/profilo'

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-6 py-7 border-b border-obsidian-light flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl text-cream tracking-[0.2em] font-light">
            RIDENTIUM
          </h1>
          <p className="text-stone/60 text-[10px] tracking-[0.3em] uppercase mt-0.5">
            {isAdmin ? 'Admin' : 'Staff'}
          </p>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden text-stone/50 hover:text-cream p-1 transition-colors"
          onClick={() => setIsOpen(false)}
          aria-label="Chiudi menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search button */}
      <div className="px-3 pt-3">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded border border-obsidian-light
                     text-stone/60 hover:text-stone hover:border-stone/30 hover:bg-obsidian-light/30
                     text-xs transition-colors"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Cerca…</span>
          <kbd className="hidden sm:inline-flex text-[10px] font-mono text-stone/30 border border-obsidian-light rounded px-1">⌘K</kbd>
        </button>
      </div>

      {/* Alert banner scorte sotto soglia */}
      {alertCount > 0 && (
        <Link
          href={isAdmin ? '/admin/magazzino' : '/staff/magazzino'}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded bg-alert/10
                     border border-alert/20 text-red-400 text-xs hover:bg-alert/15 transition-colors"
        >
          <AlertTriangle size={12} />
          <span>{alertCount} prodott{alertCount === 1 ? 'o' : 'i'} sotto soglia</span>
          <ChevronRight size={10} className="ml-auto" />
        </Link>
      )}

      {/* Alert banner prodotti in scadenza */}
      {scadenzaCount > 0 && (
        <Link
          href={isAdmin ? '/admin/magazzino' : '/staff/magazzino'}
          className="mx-3 mt-1.5 flex items-center gap-2 px-3 py-2 rounded bg-amber-400/10
                     border border-amber-400/20 text-amber-400 text-xs hover:bg-amber-400/15 transition-colors"
        >
          <Clock size={12} />
          <span>{scadenzaCount} prodott{scadenzaCount === 1 ? 'o' : 'i'} in scadenza</span>
          <ChevronRight size={10} className="ml-auto" />
        </Link>
      )}

      {/* Navigazione */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && href !== '/staff' && pathname.startsWith(href))
          const badge = href === '/admin/ordini' && ordiniAperti > 0 ? ordiniAperti : null
          return (
            <Link
              key={href}
              href={href}
              className={cn('nav-item', active && 'active')}
            >
              <Icon size={15} className={active ? 'text-gold' : ''} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/30 font-medium">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Profilo utente */}
      <div className="border-t border-obsidian-light px-3 py-3">
        <Link
          href={profiloHref}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded transition-colors mb-1',
            pathname === profiloHref
              ? 'bg-stone-dark/20 border border-gold/20'
              : 'hover:bg-obsidian-light/50'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30
                          flex items-center justify-center text-gold text-xs font-medium flex-shrink-0">
            {profilo.nome[0]}{profilo.cognome[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-cream text-sm font-medium truncate">
              {profilo.nome} {profilo.cognome}
            </p>
            <p className={cn('text-xs', roleColor(profilo.ruolo))}>
              {roleLabel(profilo.ruolo)}
            </p>
          </div>
          <UserCircle size={13} className="text-stone/50 flex-shrink-0" />
        </Link>

        <button
          onClick={handleLogout}
          className="btn-ghost w-full flex items-center gap-2 text-stone/60 hover:text-red-400 text-xs px-3 py-2"
        >
          <LogOut size={13} />
          Esci
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile hamburger trigger (top-left fixed button) ── */}
      <button
        className="md:hidden fixed top-3.5 left-4 z-50 p-2 rounded-lg bg-obsidian
                   border border-obsidian-light text-cream shadow-lg hover:bg-obsidian-light
                   transition-colors"
        onClick={() => setIsOpen(true)}
        aria-label="Apri menu"
      >
        <Menu size={18} />
      </button>

      {/* ── Mobile overlay backdrop ── */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'flex flex-col bg-obsidian border-r border-obsidian-light',
          // Desktop
          'md:relative md:w-56 md:min-h-screen md:translate-x-0 md:flex',
          // Mobile
          'fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Global search modal */}
      <SearchModal
        isAdmin={isAdmin}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  )
}
