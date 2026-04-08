import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import Link from 'next/link'
import { Package, CheckSquare, BookOpen, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function StaffHome() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profilo } = await supabase
    .from('profili')
    .select('nome, cognome')
    .eq('id', user!.id)
    .single()

  // Task assegnati all'utente
  const { data: myTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('assegnato_a', user!.id)
    .neq('stato', 'completato')
    .order('priorita', { ascending: false })
    .order('scadenza', { ascending: true, nullsFirst: false })
    .limit(5)

  // Prodotti sotto soglia
  const { data: magazzinoAll } = await supabase
    .from('magazzino')
    .select('id, prodotto, quantita, soglia_minima')

  const alertItems = (magazzinoAll ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  )

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div>
      <PageHeader
        title={`Ciao, ${profilo?.nome ?? ''}.`}
        subtitle={oggi.charAt(0).toUpperCase() + oggi.slice(1)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* I miei task */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-widest text-stone flex items-center gap-2">
              <CheckSquare size={13} /> I miei task
            </h3>
            <Link href="/staff/tasks" className="text-xs text-gold hover:text-gold-light transition-colors">
              Vedi tutti →
            </Link>
          </div>
          {myTasks?.length === 0 ? (
            <p className="text-stone text-sm py-4 text-center">Nessun task assegnato</p>
          ) : (
            <div className="space-y-2">
              {myTasks?.map((task: any) => (
                <div key={task.id} className="flex items-start justify-between py-2
                                               border-b border-obsidian-light/40 last:border-0">
                  <div>
                    <p className="text-sm text-cream">{task.titolo}</p>
                    <span className={`text-xs ${task.priorita === 'alta' ? 'text-red-400' : task.priorita === 'media' ? 'text-gold/70' : 'text-stone'}`}>
                      {task.priorita}
                    </span>
                  </div>
                  {task.scadenza && (
                    <span className="text-xs text-stone shrink-0 ml-3">
                      {formatDate(task.scadenza)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Magazzino alert */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-widest text-stone flex items-center gap-2">
              <Package size={13} /> Magazzino
            </h3>
            <Link href="/staff/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
              Vedi tutto →
            </Link>
          </div>
          {alertItems.length === 0 ? (
            <p className="text-stone text-sm py-4 text-center">✓ Tutto in ordine</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle size={11} />
                {alertItems.length} prodott{alertItems.length === 1 ? 'o' : 'i'} sotto scorta minima
              </p>
              {alertItems.slice(0, 4).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-1.5
                                               border-b border-obsidian-light/40 last:border-0">
                  <span className="text-sm text-cream/80">{item.prodotto}</span>
                  <span className="badge-alert text-xs">
                    {item.quantita}/{item.soglia_minima}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Link rapidi */}
        <div className="card lg:col-span-2">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-4 flex items-center gap-2">
            <BookOpen size={13} /> Accesso rapido
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/staff/magazzino" className="card hover:border-gold/30 transition-colors text-center py-4">
              <Package size={18} className="text-stone mx-auto mb-2" />
              <p className="text-xs text-cream">Magazzino</p>
            </Link>
            <Link href="/staff/tasks" className="card hover:border-gold/30 transition-colors text-center py-4">
              <CheckSquare size={18} className="text-stone mx-auto mb-2" />
              <p className="text-xs text-cream">I miei task</p>
            </Link>
            <Link href="/staff/sop" className="card hover:border-gold/30 transition-colors text-center py-4">
              <BookOpen size={18} className="text-stone mx-auto mb-2" />
              <p className="text-xs text-cream">Protocolli</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
