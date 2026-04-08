import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import Link from 'next/link'
import { Package, CheckSquare, BookOpen, Users, AlertTriangle, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function AdminHome() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Dati panoramica
  const [
    { data: magazzinoAll },
    { data: tasksOpen },
    { data: tasksCompleted },
    { data: sopAll },
    { data: staffAll },
    { data: riordiniAperti },
  ] = await Promise.all([
    supabase.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria'),
    supabase.from('tasks').select('id, titolo, priorita, scadenza, assegnato_a').neq('stato', 'completato'),
    supabase.from('tasks').select('id').eq('stato', 'completato'),
    supabase.from('sop').select('id'),
    supabase.from('profili').select('id, nome, cognome, ruolo').eq('attivo', true),
    supabase.from('riordini').select('id, created_at, magazzino_id, magazzino(prodotto)').eq('stato', 'aperta'),
  ])

  const alertItems = (magazzinoAll ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  )
  const taskUrgenti = (tasksOpen ?? []).filter((t: any) => t.priorita === 'alta')

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div>
      <PageHeader
        title="Buongiorno, Mariano."
        subtitle={oggi.charAt(0).toUpperCase() + oggi.slice(1)}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Prodotti sotto soglia"
          value={alertItems.length}
          icon={AlertTriangle}
          href="/admin/magazzino"
          alert={alertItems.length > 0}
        />
        <StatCard
          label="Task aperti"
          value={tasksOpen?.length ?? 0}
          icon={CheckSquare}
          href="/admin/tasks"
        />
        <StatCard
          label="Riordini da evadere"
          value={riordiniAperti?.length ?? 0}
          icon={Package}
          href="/admin/magazzino"
          alert={(riordiniAperti?.length ?? 0) > 0}
        />
        <StatCard
          label="Membri staff attivi"
          value={staffAll?.length ?? 0}
          icon={Users}
          href="/admin/staff"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alert magazzino */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
              Magazzino — Sotto Soglia
            </h3>
            <Link href="/admin/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
              Vedi tutto →
            </Link>
          </div>
          {alertItems.length === 0 ? (
            <p className="text-stone text-sm py-4 text-center">✓ Tutto in ordine</p>
          ) : (
            <div className="space-y-2">
              {alertItems.slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2
                                               border-b border-obsidian-light/40 last:border-0">
                  <span className="text-sm text-cream/80">{item.prodotto}</span>
                  <span className="badge-alert">
                    <AlertTriangle size={10} />
                    {item.quantita}/{item.soglia_minima} {' '}pz
                  </span>
                </div>
              ))}
              {alertItems.length > 5 && (
                <p className="text-stone text-xs text-center pt-1">
                  +{alertItems.length - 5} altri prodotti
                </p>
              )}
            </div>
          )}
        </div>

        {/* Task urgenti */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
              Task ad alta priorità
            </h3>
            <Link href="/admin/tasks" className="text-xs text-gold hover:text-gold-light transition-colors">
              Vedi tutto →
            </Link>
          </div>
          {taskUrgenti.length === 0 ? (
            <p className="text-stone text-sm py-4 text-center">Nessun task urgente</p>
          ) : (
            <div className="space-y-2">
              {taskUrgenti.slice(0, 5).map((task: any) => (
                <div key={task.id} className="flex items-start justify-between py-2
                                               border-b border-obsidian-light/40 last:border-0">
                  <span className="text-sm text-cream/80">{task.titolo}</span>
                  {task.scadenza && (
                    <span className="text-xs text-stone ml-3 shrink-0">
                      {formatDate(task.scadenza)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Riordini aperti */}
        {(riordiniAperti?.length ?? 0) > 0 && (
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
                Richieste Riordino da Evadere
              </h3>
              <Link href="/admin/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
                Gestisci →
              </Link>
            </div>
            <table className="table-ridentium">
              <thead>
                <tr>
                  <th>Prodotto</th>
                  <th>Richiesta il</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {riordiniAperti?.map((r: any) => (
                  <tr key={r.id}>
                    <td>{(r.magazzino as any)?.prodotto ?? '—'}</td>
                    <td>{formatDate(r.created_at)}</td>
                    <td><span className="badge-alert">Aperta</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, href, alert = false
}: {
  label: string
  value: number
  icon: React.ElementType
  href: string
  alert?: boolean
}) {
  return (
    <Link href={href} className="card hover:border-gold/30 transition-colors group block">
      <div className="flex items-start justify-between mb-3">
        <Icon size={16} className={alert && value > 0 ? 'text-red-400' : 'text-stone'} />
        <span className="text-[10px] text-stone group-hover:text-gold transition-colors">→</span>
      </div>
      <p className={`text-3xl font-light font-serif mb-1 ${alert && value > 0 ? 'text-red-400' : 'text-cream'}`}>
        {value}
      </p>
      <p className="text-xs text-stone uppercase tracking-wider">{label}</p>
    </Link>
  )
}
