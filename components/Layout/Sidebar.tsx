'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { unsubscribeUser } from '@/lib/push'
import { UserProfile } from '@/types'
import { cn, roleLabel } from '@/lib/utils'
import {
  LayoutDashboard, Package, CheckSquare, BookOpen, Users, LogOut, ChevronRight,
  AlertTriangle, ShoppingCart, UserCircle2, RefreshCw, Activity, Sparkles,
  Building2, X, Bell,
} from 'lucide-react'
import NotificheBell from '@/components/Notifiche/NotificheBell'

interface NavItem { href:string; label:string; icon:React.ElementType; highlight?:boolean }

const adminHome: NavItem[]       = [{ href:'/admin', label:'Panoramica', icon:LayoutDashboard }]
const adminOperazioni: NavItem[] = [
  { href:'/admin/magazzino', label:'Magazzino', icon:Package },
  { href:'/admin/ordini',    label:'Ordini',    icon:ShoppingCart },
  { href:'/admin/fornitori', label:'Fornitori', icon:Building2 },
]
const adminTeam: NavItem[] = [
  { href:'/admin/tasks',      label:'Task',      icon:CheckSquare },
  { href:'/admin/ricorrenti', label:'Ricorrenti', icon:RefreshCw },
  { href:'/admin/crm',        label:'CRM',       icon:UserCircle2 },
  { href:'/admin/staff',      label:'Staff',     icon:Users },
]
const adminSistema: NavItem[] = [
  { href:'/admin/sop',         label:'Protocolli', icon:BookOpen },
  { href:'/admin/registro',    label:'Registro',   icon:Activity },
  { href:'/admin/notifiche',   label:'Notifiche',  icon:Bell },
]
const adminAI: NavItem[] = [{ href:'/admin/ai', label:'Lina AI', icon:Sparkles, highlight:true }]

const staffNav: NavItem[] = [
  { href:'/staff',             label:'Home',        icon:LayoutDashboard },
  { href:'/staff/magazzino',   label:'Magazzino',   icon:Package },
  { href:'/staff/tasks',       label:'I miei task', icon:CheckSquare },
  { href:'/staff/ricorrenti',  label:'Ricorrenti',  icon:RefreshCw },
  { href:'/staff/sop',         label:'Protocolli',  icon:BookOpen },
  { href:'/staff/notifiche',   label:'Notifiche',   icon:Bell },
]

interface SidebarProps { profilo:UserProfile; alertCount?:number; tasksCount?:number; onClose?:()=>void }

function NavGroup({ label, items, pathname, onClose, badges }: {
  label?:string; items:NavItem[]; pathname:string; onClose?:()=>void; badges?:Record<string,number>
}) {
  return (
    <div>
      {label && (
        <p className="px-3 mb-1 text-[9px] uppercase tracking-[0.2em] font-medium select-none"
          style={{ color:'rgba(160,144,126,0.5)' }}>{label}</p>
      )}
      {items.map(({ href, label:itemLabel, icon:Icon, highlight }) => {
        const active = pathname === href || (href !== '/admin' && href !== '/staff' && pathname.startsWith(href))
        const badge  = badges?.[href]
        return (
          <Link key={href} href={href} onClick={onClose}
            className={cn('nav-item', active && 'active', highlight && !active && 'text-gold/70 hover:text-gold')}>
            <Icon size={15} className={active ? 'text-gold' : highlight ? 'text-gold/60' : ''} />
            <span>{itemLabel}</span>
            {badge && badge > 0 && !active && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background:'rgba(224,85,69,0.85)', color:'#FFF', minWidth:18, textAlign:'center' }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
            {highlight && !active && !badge && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-sm bg-gold/10 text-gold/70 border border-gold/20">AI</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export default function Sidebar({ profilo, alertCount=0, tasksCount=0, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const isAdmin  = profilo.ruolo === 'admin'

  async function handleLogout() {
    // Remove push subscription for this device BEFORE signing out
    // to prevent notifications going to the next user on a shared device.
    try { await unsubscribeUser() } catch {}
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="w-64 md:w-56 h-full flex flex-col"
      style={{
        background: '#1A1009',
        borderRight: '1px solid rgba(74,59,44,0.6)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      {/* Header */}
      <div className="px-6 py-6 flex items-start justify-between"
        style={{ borderBottom:'1px solid rgba(74,59,44,0.5)' }}>
        <div>
          <h1 className="font-serif text-xl tracking-[0.2em] font-light" style={{ color:'#F2EDE4' }}>RIDENTIUM</h1>
          <p className="text-[10px] tracking-[0.3em] uppercase mt-0.5"
            style={{ color:'rgba(210,198,182,0.5)' }}>{isAdmin ? 'Admin' : 'Staff'}</p>
        </div>
        <div className="flex items-center gap-1 -mr-1">
          {/* Desktop-only: su mobile la campanella è nel header AdminShell per evitare doppione */}
          <div className="hidden md:block">
            <NotificheBell isAdmin={isAdmin} />
          </div>
          <button
            onClick={onClose}
            className="md:hidden transition-colors flex items-center justify-center"
            style={{ color:'rgba(160,144,126,0.5)', minWidth: 44, minHeight: 44 }}
            aria-label="Chiudi menu"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Alert magazzino */}
      {alertCount > 0 && (
        <Link href={(isAdmin ? '/admin/magazzino' : '/staff/magazzino') + '?filter=alert'} onClick={onClose}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors"
          style={{ background:'rgba(224,85,69,0.15)', border:'1px solid rgba(224,85,69,0.35)', color:'#F87171' }}>
          <AlertTriangle size={12} />
          <span>{alertCount} prodott{alertCount===1?'o':'i'} sotto soglia</span>
          <ChevronRight size={10} className="ml-auto" />
        </Link>
      )}

      {/* Nav */}
      {isAdmin ? (
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          <NavGroup items={adminHome} pathname={pathname} onClose={onClose} />
          <NavGroup label="Operazioni" items={adminOperazioni} pathname={pathname} onClose={onClose}
            badges={{ '/admin/magazzino': alertCount }} />
          <NavGroup label="Team" items={adminTeam} pathname={pathname} onClose={onClose}
            badges={{ '/admin/tasks': tasksCount }} />
          <NavGroup label="Sistema" items={adminSistema} pathname={pathname} onClose={onClose} />
          <div style={{ borderTop:'1px solid rgba(74,59,44,0.4)' }} className="pt-3">
            <NavGroup items={adminAI} pathname={pathname} onClose={onClose} />
          </div>
        </nav>
      ) : (
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <NavGroup items={staffNav} pathname={pathname} onClose={onClose} />
        </nav>
      )}

      {/* User footer */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{
          borderTop: '1px solid rgba(74,59,44,0.4)',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
            style={{ background:'rgba(201,168,76,0.2)', border:'1px solid rgba(201,168,76,0.4)', color:'#C9A84C' }}>
            {profilo.nome[0]}{profilo.cognome[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color:'#F2EDE4' }}>
              {profilo.nome} {profilo.cognome}
            </p>
            <p className="text-xs" style={{ color:'rgba(210,198,182,0.5)' }}>{roleLabel(profilo.ruolo)}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors"
          style={{ color:'rgba(160,144,126,0.6)' }}
          onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')}
          onMouseLeave={e=>(e.currentTarget.style.color='rgba(160,144,126,0.6)')}>
          <LogOut size={13} />Esci
        </button>
      </div>
    </aside>
  )
}
