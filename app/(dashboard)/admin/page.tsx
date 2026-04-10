import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import Link from 'next/link'
import { Package, CheckSquare, Users, AlertTriangle, TrendingUp, Calendar, Euro, Activity, RefreshCw, ShoppingCart, BarChart2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function AdminHome() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: magazzinoAll },
    { data: tasksAll },
    { data: staffAll },
    { data: riordiniAperti },
    { data: kpi },
    { data: ricorrenti },
    { data: profilo },
    { data: ordiniAll },
  ] = await Promise.all([
    supabase.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria, azienda, prezzo_unitario'),
    supabase.from('tasks').select('id, titolo, priorita, scadenza, assegnato_a, stato'),
    adminDb.from('profili').select('id, nome, cognome, ruolo').eq('attivo', true),
    supabase.from('riordini').select('id, created_at, magazzino_id, magazzino(prodotto)').eq('stato', 'aperta'),
    supabase.from('kpi').select('*').single(),
    supabase.from('ricorrenti').select('*').eq('attiva', true),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
    adminDb.from('ordini').select('id, stato, fornitore_nome, created_at').order('created_at', { ascending: false }),
  ])

  const tasksOpen = (tasksAll ?? []).filter((t: any) => t.stato !== 'completato')
  const alertItems = (magazzinoAll ?? []).filter((item: any) => item.quantita < item.soglia_minima)
  const taskUrgenti = tasksOpen.filter((t: any) => t.priorita === 'alta')

  // Valore magazzino
  const valoreMagazzino = (magazzinoAll ?? []).reduce((s: number, i: any) =>
    s + (i.quantita ?? 0) * (i.prezzo_unitario ?? 0), 0
  )

  // Ricorrenti pendenti dell'admin
  function getPeriodoKey(frequenza: string): string {
    const now = new Date()
    if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
    if (frequenza === 'settimanale') {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay() + 1)
      return 'W' + d.toISOString().split('T')[0]
    }
    if (frequenza === 'mensile') return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
    return now.toISOString().split('T')[0]
  }

  const ricorrentiPendenti = (ricorrenti ?? []).filter((az: any) => {
    if (!az.attiva) return false
    if (az.assegnato_a && az.assegnato_a !== user!.id) return false
    const key = getPeriodoKey(az.frequenza)
    const completamenti = Array.isArray(az.completamenti) ? az.completamenti : []
    return !completamenti.some((c: any) => c.userId === user!.id && c.periodoKey === key)
  })

  // ── Statistiche ──────────────────────────────────────────────────────────────

  // Task per stato
  const taskDaFare    = (tasksAll ?? []).filter((t: any) => t.stato === 'da_fare').length
  const taskInCorso   = (tasksAll ?? []).filter((t: any) => t.stato === 'in_corso').length
  const taskCompletati = (tasksAll ?? []).filter((t: any) => t.stato === 'completato').length
  const taskTotali    = (tasksAll ?? []).length

  // Magazzino per categoria
  const categorieMap: Record<string, { ok: number; alert: number }> = {}
  for (const item of (magazzinoAll ?? [])) {
    const cat = (item as any).categoria ?? 'Altro'
    if (!categorieMap[cat]) categorieMap[cat] = { ok: 0, alert: 0 }
    if ((item as any).quantita < (item as any).soglia_minima) categorieMap[cat].alert++
    else categorieMap[cat].ok++
  }
  const categorieStat = Object.entries(categorieMap)
    .map(([cat, v]) => ({ cat, total: v.ok + v.alert, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
  const maxCatTotal = Math.max(...categorieStat.map(c => c.total), 1)

  // Ordini per stato (ultimi 30 gg vs tutti)
  const ordiniRecenti = (ordiniAll ?? []).filter((o: any) =>
    new Date(o.created_at) >= thirtyDaysAgo
  )
  const ordiniPerStato = {
    inviato:   (ordiniAll ?? []).filter((o: any) => o.stato === 'inviato').length,
    parziale:  (ordiniAll ?? []).filter((o: any) => o.stato === 'parziale').length,
    ricevuto:  (ordiniAll ?? []).filter((o: any) => o.stato === 'ricevuto').length,
    annullato: (ordiniAll ?? []).filter((o: any) => o.stato === 'annullato').length,
  }
  const ordiniTotali = Object.values(ordiniPerStato).reduce((a, b) => a + b, 0)

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const nomeAdmin = profilo?.nome ?? 'Mariano'

  return (
    <div>
      <PageHeader
        title={`Buongiorno, ${nomeAdmin}.`}
        subtitle={oggi.charAt(0).toUpperCase() + oggi.slice(1)}
      />

      {/* KPI clinici (se configurati) */}
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

      {/* KPI operativi */}
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
          label="Valore magazzino"
          value={`€${Math.round(valoreMagazzino).toLocaleString('it-IT')}`}
          icon={Package}
          href="/admin/magazzino"
          asText
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

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
                    {item.quantita}/{item.soglia_minima}
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
                  <span className="text-xs text-stone capitalize">{az.frequenza}</span>
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
                <div key={r.id} className="flex items-center justify-between py-2
                                            border-b border-obsidian-light/40 last:border-0">
                  <span className="text-sm text-cream/80">{(r.magazzino as any)?.prodotto ?? '—'}</span>
                  <span className="badge-alert">Aperta</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Statistiche ─────────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center gap-2">
        <BarChart2 size={14} className="text-stone" />
        <h2 className="text-xs uppercase tracking-widest text-stone">Statistiche</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Task per stato */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-4">Task — distribuzione</h3>
          {taskTotali === 0 ? (
            <p className="text-stone text-sm text-center py-4">Nessun task</p>
          ) : (
            <>
              {/* Barra composta */}
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 gap-px">
                {taskDaFare > 0 && (
                  <div
                    className="bg-stone/40 rounded-l-full"
                    style={{ width: `${(taskDaFare / taskTotali) * 100}%` }}
                  />
                )}
                {taskInCorso > 0 && (
                  <div
                    className="bg-gold/70"
                    style={{ width: `${(taskInCorso / taskTotali) * 100}%` }}
                  />
                )}
                {taskCompletati > 0 && (
                  <div
                    className="bg-green-500/70 rounded-r-full"
                    style={{ width: `${(taskCompletati / taskTotali) * 100}%` }}
                  />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone">
                    <span className="w-2 h-2 rounded-full bg-stone/40 flex-shrink-0" /> Da fare
                  </span>
                  <span className="text-cream">{taskDaFare} <span className="text-stone">/ {taskTotali}</span></span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone">
                    <span className="w-2 h-2 rounded-full bg-gold/70 flex-shrink-0" /> In corso
                  </span>
                  <span className="text-cream">{taskInCorso} <span className="text-stone">/ {taskTotali}</span></span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone">
                    <span className="w-2 h-2 rounded-full bg-green-500/70 flex-shrink-0" /> Completati
                  </span>
                  <span className="text-cream">{taskCompletati} <span className="text-stone">/ {taskTotali}</span></span>
                </div>
              </div>
              <p className="text-[10px] text-stone/50 mt-3 text-right">
                {taskTotali > 0 ? Math.round((taskCompletati / taskTotali) * 100) : 0}% completati
              </p>
            </>
          )}
        </div>

        {/* Magazzino per categoria */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-4">Magazzino — categorie</h3>
          {categorieStat.length === 0 ? (
            <p className="text-stone text-sm text-center py-4">Nessun prodotto</p>
          ) : (
            <div className="space-y-3">
              {categorieStat.map(({ cat, total, ok, alert }) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cream/80 truncate max-w-[70%]">{cat}</span>
                    <span className="text-[10px] text-stone flex-shrink-0">
                      {total} prod.{alert > 0 && <span className="text-red-400 ml-1">· {alert} ⚠</span>}
                    </span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-obsidian-light/30">
                    {ok > 0 && (
                      <div
                        className="bg-green-500/50"
                        style={{ width: `${(ok / maxCatTotal) * 100}%` }}
                      />
                    )}
                    {alert > 0 && (
                      <div
                        className="bg-red-400/60"
                        style={{ width: `${(alert / maxCatTotal) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ordini per stato */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-widest text-stone">Ordini fornitori</h3>
            <Link href="/admin/ordini" className="text-xs text-gold">Vedi →</Link>
          </div>
          {ordiniTotali === 0 ? (
            <p className="text-stone text-sm text-center py-4">Nessun ordine</p>
          ) : (
            <>
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 gap-px">
                {ordiniPerStato.inviato > 0 && (
                  <div className="bg-gold/60 rounded-l-full" style={{ width: `${(ordiniPerStato.inviato / ordiniTotali) * 100}%` }} />
                )}
                {ordiniPerStato.parziale > 0 && (
                  <div className="bg-blue-400/60" style={{ width: `${(ordiniPerStato.parziale / ordiniTotali) * 100}%` }} />
                )}
                {ordiniPerStato.ricevuto > 0 && (
                  <div className="bg-green-500/60" style={{ width: `${(ordiniPerStato.ricevuto / ordiniTotali) * 100}%` }} />
                )}
                {ordiniPerStato.annullato > 0 && (
                  <div className="bg-stone/30 rounded-r-full" style={{ width: `${(ordiniPerStato.annullato / ordiniTotali) * 100}%` }} />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone"><span className="w-2 h-2 rounded-full bg-gold/60 flex-shrink-0" /> In attesa</span>
                  <span className="text-cream">{ordiniPerStato.inviato + ordiniPerStato.parziale}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone"><span className="w-2 h-2 rounded-full bg-green-500/60 flex-shrink-0" /> Ricevuti</span>
                  <span className="text-cream">{ordiniPerStato.ricevuto}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-stone"><span className="w-2 h-2 rounded-full bg-stone/30 flex-shrink-0" /> Annullati</span>
                  <span className="text-cream">{ordiniPerStato.annullato}</span>
                </div>
              </div>
              <p className="text-[10px] text-stone/50 mt-3 text-right">
                {ordiniRecenti.length} ordini negli ultimi 30 gg
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string
}) {
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

function StatCard({
  label, value, icon: Icon, href, alert = false, asText = false
}: {
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
