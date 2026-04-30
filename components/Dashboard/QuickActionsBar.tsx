import Link from 'next/link'
import { CalendarDays, CheckSquare, Package, ShieldCheck, Plus } from 'lucide-react'

const AZIONI = [
  {
    href: '/admin/agenda',
    icon: CalendarDays,
    label: 'Agenda',
    desc: 'Task, ricorrenti e adempimenti',
  },
  {
    href: '/admin/tasks',
    icon: CheckSquare,
    label: 'Task',
    desc: 'Gestisci e assegna task',
  },
  {
    href: '/admin/magazzino',
    icon: Package,
    label: 'Magazzino',
    desc: 'Scorte e soglie minime',
  },
  {
    href: '/admin/adempimenti',
    icon: ShieldCheck,
    label: 'Adempimenti',
    desc: 'Scadenze normative',
  },
]

export default function QuickActionsBar() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {AZIONI.map(({ href, icon: Icon, label, desc }) => (
        <Link
          key={href}
          href={href}
          className="card flex items-center gap-3 hover:border-gold/30 transition-all group py-3"
        >
          <div className="p-2 rounded-lg bg-gold/10 border border-gold/20 flex-shrink-0 group-hover:bg-gold/20 transition-colors">
            <Icon size={15} className="text-gold/70 group-hover:text-gold transition-colors" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-cream font-medium">{label}</p>
            <p className="text-[11px] text-stone mt-0.5 hidden sm:block leading-tight">{desc}</p>
          </div>
          <Plus size={12} className="text-stone/30 group-hover:text-gold/50 transition-colors flex-shrink-0 mr-1" />
        </Link>
      ))}
    </div>
  )
}
