import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import Link from 'next/link'
import { Package, CheckSquare, Users, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import SottoSogliaOrdina from '@/components/Dashboard/SottoSogliaOrdina'
import TasksRicorrentiWidget from '@/components/Dashboard/TasksRicorrentiWidget'

export default async function AdminHome() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: magazzinoAll },
    { data: tasksOpen },
    { data: staffAll },
    { data: riordiniAperti },
    { data: fornitori },
    { data: ricorrenti },
    { data: profilo },
  ] = await Promise.all([
    supabase.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria, fornitore_id, unita'),
    supabase.from('tasks').select('id, titolo, priorita, scadenza, assegnato_a, stato').neq('stato', 'completato'),
    supabase.from('profili').select('id, nome, cognome, ruolo').eq('attivo', true),
    supabase.from('riordini').select('id, created_at, magazzino_id, magazzino(prodotto)').eq('stato', 'aperta'),
    supabase.from('fornitori').select('*'),
    supabase.from('ricorrenti').select('*').eq('attiva', true).order('created_at', { ascending: true }),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  const alertItems = (magazzinoAll ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  )
  const userNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()

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

        {/* Ordine rapido */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
              Ordine Rapido — Sotto Soglia
            </h3>
            <Link href="/admin/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
              Vai al magazzino →
            </Link>
          </div>
          <SottoSogliaOrdina
            alertItems={alertItems as any}
            fornitori={fornitori ?? []}
            userId={user!.id}
            userNome={userNome}
          />
        </div>

        {/* Task + Azioni Ricorrenti — spuntabili */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
              Task & Azioni Ricorrenti
            </h3>
            <div className="flex items-center gap-3">
              <Link href="/admin/ricorrenti" className="text-xs text-stone hover:text-gold transition-colors">
                Ricorrenti →
              </Link>
              <Link href="/admin/tasks" className="text-xs text-gold hover:text-gold-light transition-colors">
                Task →
              </Link>
            </div>
          </div>
          <TasksRicorrentiWidget
            tasks={(tasksOpen ?? []) as any}
            ricorrenti={(ricorrenti ?? []).map((r: any) => ({
              ...r,
              completamenti: Array.isArray(r.completamenti) ? r.completamenti : [],
            }))}
            currentUserId={user!.id}
            currentUserNome={userNome}
          />
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
            <div className="overflow-x-auto">
              <table className="table-ridentium" style={{ minWidth: '480px' }}>
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
