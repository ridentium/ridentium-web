import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import Link from 'next/link'
import { Package, CheckSquare, AlertTriangle, TrendingUp, Calendar, Euro, Activity, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import SottoSogliaOrdina from '@/components/Dashboard/SottoSogliaOrdina'

function getPeriodoKey(frequenza: string): string {
  const now = new Date()
  if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
  if (frequenza === 'settimanale') {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1)
    return 'W' + d.toISOString().split('T')[0]
  }
  if (frequenza === 'mensile') return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  const m = frequenza.match(/^ogni_(\d+)_(giorni|settimane|mesi)$/)
  if (m) {
    const n = parseInt(m[1]); const unita = m[2]
    const epoch = new Date('2024-01-01').getTime()
    if (unita === 'giorni') { const days = Math.floor((now.getTime() - epoch) / 86400000); return 'D' + n + '_' + Math.floor(days / n) }
    if (unita === 'settimane') { const weeks = Math.floor((now.getTime() - epoch) / (7 * 86400000)); return 'W' + n + '_' + Math.floor(weeks / n) }
    if (unita === 'mesi') { const tm = now.getFullYear() * 12 + now.getMonth(); return 'M' + n + '_' + Math.floor((tm - 2024 * 12) / n) }
  }
  return now.toISOString().split('T')[0]
}

function freqLabel(frequenza: string): string {
  if (frequenza === 'giornaliero') return 'Ogni giorno'
  if (frequenza === 'settimanale') return 'Ogni settimana'
  if (frequenza === 'mensile') return 'Ogni mese'
  const m = frequenza.match(/^ogni_(\d+)_(giorni|settimane|mesi)$/)
  if (m) { const n = parseInt(m[1]); return n === 1 ? 'Ogni ' + m[2].slice(0, -1) : `Ogni ${n} ${m[2]}` }
  return frequenza
}

export default async function AdminHome() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: magazzinoAll },
    { data: tasksOpen },
    { data: tasksCompleted },
    { data: riordiniAperti },
    { data: kpi },
    { data: ricorrenti },
    { data: profilo },
    { data: fornitori },
  ] = await Promise.all([
    adminDb.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria, azienda, prezzo_unitario, fornitore_id, unita'),
    supabase.from('tasks').select('id, titolo, priorita, scadenza, assegnato_a').neq('stato', 'completato'),
    supabase.from('tasks').select('id').eq('stato', 'completato'),
    supabase.from('riordini').select('id, created_at, magazzino_id, magazzino(prodotto)').eq('stato', 'aperta'),
    supabase.from('kpi').select('*').single(),
    supabase.from('ricorrenti').select('*').eq('attiva', true),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
    adminDb.from('fornitori').select('id, nome, telefono, email').order('nome'),
  ])

  const alertItems = (magazzinoAll ?? []).filter(
    (item: any) => item.quantita < item.soglia_minima
  )
  const taskUrgenti = (tasksOpen ?? []).filter((t: any) => t.priorita === 'alta')

  const valoreMagazzino = (magazzinoAll ?? []).reduce(
    (s: number, i: any) => s + (i.quantita ?? 0) * (i.prezzo_unitario ?? 0), 0
  )

  const ricorrentiPendenti = (ricorrenti ?? []).filter((az: any) => {
    if (!az.attiva) return false
    if (az.assegnato_a && az.assegnato_a !== user!.id) return false
    const key = getPeriodoKey(az.frequenza)
    const completamenti = Array.isArray(az.completamenti) ? az.completamenti : []
    return !completamenti.some((c: any) => c.userId === user!.id && c.periodoKey === key)
  })

  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const nomeAdmin = profilo?.nome ?? 'Mariano'

  return (
    <div>
      <PageHeader title={`Buongiorno, ${nomeAdmin}.`} subtitle={oggi.charAt(0).toUpperCase() + oggi.slice(1)} />

      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Pazienti oggi" value={kpi.pazienti_oggi} icon={Calendar} color="text-cream" />
          <KpiCard label="Pazienti sett." value={kpi.pazienti_settimana} icon={Calendar} color="text-cream" />
          <KpiCard label="Pazienti mese" value={kpi.pazienti_mese} icon={Activity} color="text-cream" />
          <KpiCard label="Appuntamenti" value={kpi.appuntamenti_oggi} icon={Calendar} color="text-cream" />
          <KpiCard label="Fatturato mese" value={`€${kpi.fatturato_mese.toLocaleString('it-IT')}`} icon={Euro} color="text-gold" />
          <KpiCard label="Tasso presenze" value={`${kpi.tasso_presenze}%`} icon={TrendingUp} color={kpi.tasso_presenze >= 90 ? 'text-green-400' : 'text-gold'} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Prodotti sotto soglia" value={alertItems.length} icon={AlertTriangle} href="/admin/magazzino" alert={alertItems.length > 0} />
        <StatCard label="Task aperti" value={tasksOpen?.length ?? 0} icon={CheckSquare} href="/admin/tasks" />
        <StatCard label="Riordini da evadere" value={riordiniAperti?.length ?? 0} icon={Package} href="/admin/magazzino" alert={(riordiniAperti?.length ?? 0) > 0} />
        <StatCard label="Valore magazzino" value={`€${Math.round(valoreMagazzino).toLocaleString('it-IT')}`} icon={Package} href="/admin/magazzino" asText />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sotto soglia con pulsante ordine */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
              Magazzino — Sotto Soglia
            </h3>
            <Link href="/admin/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
              Vedi tutto →
            </Link>
          </div>
          <SottoSogliaOrdina
            alertItems={alertItems as any}
            fornitori={fornitori ?? []}
            userId={user!.id}
            userNome={nomeAdmin}
          />
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
                <div key={task.id} className="flex items-start justify-between py-2 border-b border-obsidian-light/40 last:border-0">
                  <span className="text-sm text-cream/80">{task.titolo}</span>
                  {task.scadenza && (
                    <span className="text-xs text-stone ml-3 shrink-0">{formatDate(task.scadenza)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Azioni ricorrenti pendenti */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cream uppercase tracking-widest flex items-center gap-2">
              <RefreshCw size={13} /> Azioni Ricorrenti
            </h3>
            <Link href="/admin/ricorrenti" className="text-xs text-gold hover:text-gold-light transition-colors">
              Gestisci →
            </Link>
          </div>
          {ricorrentiPendenti.length === 0 ? (
            <p className="text-stone text-sm py-4 text-center">✓ Tutte completate per questo periodo</p>
          ) : (
            <div className="space-y-1">
              {ricorrentiPendenti.slice(0, 5).map((az: any) => (
                <div key={az.id} className="flex items-center gap-3 py-2 border-b border-obsidian-light/40 last:border-0">
                  <span className="text-stone text-sm">○</span>
                  <span className="text-sm text-cream/80 flex-1">{az.titolo}</span>
                  <span className="text-xs text-stone">{freqLabel(az.frequenza)}</span>
                </div>
              ))}
              {ricorrentiPendenti.length > 5 && (
                <p className="text-stone text-xs text-center pt-1">+{ricorrentiPendenti.length - 5} altre</p>
              )}
            </div>
          )}
        </div>

        {/* Riordini aperti */}
        {(riordiniAperti?.length ?? 0) > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-cream uppercase tracking-widest">
                Richieste Riordino
              </h3>
              <Link href="/admin/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
                Gestisci →
              </Link>
            </div>
            <div className="space-y-2">
              {riordiniAperti?.slice(0, 4).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-obsidian-light/40 last:border-0">
                  <span className="text-sm text-cream/80">{(r.magazzino as any)?.prodotto ?? '—'}</span>
                  <span className="badge-alert">Aperta</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="card py-3 px-4">
      <p className="text-[10px] uppercase tracking-widest text-stone mb-1">{label}</p>
      <div className="flex items-end gap-1.5">
        <Icon size={12} className={color} />
        <p className={`text-xl font-serif font-light ${color}`}>{value}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, href, alert = false, asText = false }: {
  label: string
  value: number | string
  icon: React.ElementType
  href: string
  alert?: boolean
  asText?: boolean
}) {
  return (
    <Link href={href} className="card hover:border-gold/30 transition-colors group block">
      <div className="flex items-start justify-between mb-3">
        <Icon size={16} className={alert && typeof value === 'number' && value > 0 ? 'text-red-400' : 'text-stone'} />
        <span className="text-[10px] text-stone group-hover:text-gold transition-colors">→</span>
      </div>
      <p className={`text-3xl font-light font-serif mb-1 ${alert && typeof value === 'number' && value > 0 ? 'text-red-400' : asText ? 'text-gold' : 'text-cream'}`}>
        {value}
      </p>
      <p className="text-xs text-stone uppercase tracking-wider">{label}</p>
    </Link>
  )
}
