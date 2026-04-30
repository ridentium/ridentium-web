import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Package, CheckSquare, Users, AlertTriangle, ShieldCheck, CalendarClock, UserPlus } from 'lucide-react'
import LinaBriefingCard from '@/components/Dashboard/LinaBriefingCard'
import TasksRicorrentiWidget from '@/components/Dashboard/TasksRicorrentiWidget'
import ScadenzeUrgentiWidget from '@/components/Dashboard/ScadenzeUrgentiWidget'
import QuickActionsBar from '@/components/Dashboard/QuickActionsBar'
import DashboardPersonalizza from '@/components/Dashboard/DashboardPersonalizza'
import OggiWidget, { type OggiItem } from '@/components/Dashboard/OggiWidget'
import type { CategoriaAdempimento, StatoAdempimento } from '@/types/adempimenti'
import { getPeriodoKey } from '@/lib/periodo'

// ── Calcola stato adempimento ─────────────────────────────────────────────────
function calcolaStatoAdempimento(prossima_scadenza: string | null, preavviso_giorni: number): StatoAdempimento {
  if (!prossima_scadenza) return 'ok'
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const scad = new Date(prossima_scadenza)
  scad.setHours(0, 0, 0, 0)
  const gg = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000)
  if (gg < 0) return 'scaduto'
  if (gg <= preavviso_giorni) return 'in_scadenza'
  return 'ok'
}

// ── Genera briefing testuale da dati reali ────────────────────────────────────
function generateBriefing(
  firstName: string,
  alertCount: number,
  tasksCount: number,
  riordiniCount: number,
  ricorrentiCount: number,
  scadutiCount: number,
  crmLeadsCount: number = 0,
): string {
  const h = new Date().getHours()
  const day = new Date().getDay()
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const isLunedi = day === 1
  const isVenerdi = day === 5

  const urgenze: string[] = []
  if (scadutiCount > 0) urgenze.push(`${scadutiCount} adempiment${scadutiCount === 1 ? 'o scaduto' : 'i scaduti'}`)
  if (alertCount > 0) urgenze.push(`${alertCount} prodott${alertCount === 1 ? 'o' : 'i'} sotto soglia`)
  if (tasksCount > 0) urgenze.push(`${tasksCount} task apert${tasksCount === 1 ? 'o' : 'i'}`)
  if (riordiniCount > 0) urgenze.push(`${riordiniCount} riordine${riordiniCount === 1 ? '' : 'i'} da evadere`)

  if (crmLeadsCount > 0) urgenze.push(`${crmLeadsCount} lead CRM da contattare`)

  if (urgenze.length === 0 && ricorrentiCount === 0) {
    const chiusura = isVenerdi
      ? 'Ottimo momento per chiudere la settimana in bellezza!'
      : isLunedi
      ? 'Buona settimana — tutto in ordine per iniziare bene.'
      : 'Nessuna urgenza, buona giornata!'
    return `${saluto} ${firstName}! Tutto sotto controllo. ${chiusura}`
  }

  const intro = isLunedi
    ? `${saluto} ${firstName}, nuova settimana!`
    : isVenerdi
    ? `${saluto} ${firstName}, ultimi task prima del weekend.`
    : `${saluto} ${firstName}.`

  if (urgenze.length === 0) {
    return `${intro} Hai ${ricorrentiCount} azion${ricorrentiCount === 1 ? 'e ricorrente' : 'i ricorrenti'} ancora da completare.`
  }

  const lista = urgenze.join(', ')
  const priorita = scadutiCount > 0
    ? 'Parti dagli adempimenti scaduti — sono la priorità.'
    : alertCount > 0
    ? 'Dai un\'occhiata al magazzino per prima cosa.'
    : tasksCount > 0
    ? 'Hai task in attesa — parti da quelli urgenti.'
    : 'Ci sono riordini da evadere nel magazzino.'

  const extra = ricorrentiCount > 0
    ? ` Inoltre ${ricorrentiCount} azion${ricorrentiCount === 1 ? 'e ricorrente' : 'i ricorrenti'} non completat${ricorrentiCount === 1 ? 'a' : 'e'}.`
    : ''

  return `${intro} Oggi: ${lista}.${extra} ${priorita}`
}

// ── Pagina ────────────────────────────────────────────────────────────────────

export default async function AdminHome() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: magazzinoAll },
    { data: tasksOpen },
    { data: staffAll },
    { data: riordiniAperti },
    { data: ricorrenti },
    { data: profilo },
    { data: adempimentiAll },
    { data: crmNuovi },
  ] = await Promise.all([
    supabase.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria'),
    supabase.from('tasks').select('id, titolo, priorita, scadenza, assegnato_a, stato').neq('stato', 'completato').is('deleted_at', null),
    supabase.from('profili').select('id').eq('attivo', true),
    supabase.from('riordini').select('id, created_at, magazzino(prodotto)').eq('stato', 'aperta'),
    supabase.from('ricorrenti').select('*').eq('attiva', true).order('created_at', { ascending: true }),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
    supabase.from('adempimenti').select('id, titolo, categoria, frequenza, prossima_scadenza, preavviso_giorni, evidenza_richiesta').eq('attivo', true),
    adminDb.from('crm_contatti').select('id, nome, cognome, created_at').eq('stato', 'nuovo').order('created_at', { ascending: false }).limit(5),
  ])

  const alertCount    = (magazzinoAll ?? []).filter((i: any) => i.quantita < i.soglia_minima).length
  const tasksCount    = tasksOpen?.length ?? 0
  const riordiniCount = riordiniAperti?.length ?? 0
  const crmLeadsCount = crmNuovi?.length ?? 0
  const userNome      = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()
  const firstName     = profilo?.nome ?? 'Mariano'

  // Ricorrenti non ancora completate per il periodo corrente
  const ricorrentiPending = (ricorrenti ?? []).filter((r: any) => {
    const key = getPeriodoKey(r.frequenza)
    return !((r.completamenti ?? []).some((c: any) => c.periodoKey === key))
  }).length

  // Adempimenti urgenti (scaduti + in_scadenza)
  const adempimentiUrgenti = (adempimentiAll ?? [])
    .map((a: any) => {
      const stato = calcolaStatoAdempimento(a.prossima_scadenza, a.preavviso_giorni ?? 30)
      const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
      const scad = a.prossima_scadenza ? new Date(a.prossima_scadenza) : null
      scad?.setHours(0, 0, 0, 0)
      const gg = scad ? Math.ceil((scad.getTime() - oggi.getTime()) / 86400000) : 999
      return { ...a, _stato: stato, _gg: gg }
    })
    .filter((a: any) => a._stato !== 'ok')
    .sort((a: any, b: any) => a._gg - b._gg) as Array<{
      id: string
      titolo: string
      categoria: CategoriaAdempimento
      frequenza: string
      prossima_scadenza: string | null
      evidenza_richiesta: string | null
      _stato: StatoAdempimento
      _gg: number
    }>

  const scadutiCount  = adempimentiUrgenti.filter(a => a._stato === 'scaduto').length

  // ── Widget Oggi ────────────────────────────────────────────────────────────
  const oggiISO = new Date().toISOString().split('T')[0]
  const oggiItems: OggiItem[] = []

  // Task con scadenza oggi e non completati
  ;(tasksOpen ?? []).forEach((t: any) => {
    if (t.scadenza === oggiISO) {
      oggiItems.push({ id: t.id, tipo: 'task', titolo: t.titolo, href: '/admin/tasks', urgente: t.priorita === 'alta' })
    }
  })

  // Adempimenti scaduti o in scadenza oggi
  adempimentiUrgenti.forEach(a => {
    if (a._gg <= 0) {
      oggiItems.push({ id: a.id, tipo: 'adempimento', titolo: a.titolo, href: '/admin/adempimenti', urgente: a._stato === 'scaduto' })
    }
  })

  // Ricorrenti non completate oggi
  const ricorrentiOggi = (ricorrenti ?? []).filter((r: any) => {
    const key = getPeriodoKey(r.frequenza)
    return !((r.completamenti ?? []).some((c: any) => c.periodoKey === key))
  }).slice(0, 3)
  ricorrentiOggi.forEach((r: any) => {
    oggiItems.push({ id: r.id, tipo: 'ricorrente', titolo: r.titolo ?? r.nome, href: '/admin/ricorrenti' })
  })

  // ── Prossimi 3 giorni ────────────────────────────────────────────────────────
  const prossimiItems: OggiItem[] = []
  const domani1 = new Date(); domani1.setHours(0,0,0,0); domani1.setDate(domani1.getDate() + 1)
  const domani4 = new Date(); domani4.setHours(23,59,59,999); domani4.setDate(domani4.getDate() + 3)
  ;(tasksOpen ?? []).forEach((t: any) => {
    if (!t.scadenza || t.scadenza === oggiISO) return
    const d = new Date(t.scadenza)
    if (d >= domani1 && d <= domani4) {
      prossimiItems.push({ id: t.id, tipo: 'task', titolo: t.titolo, href: '/admin/tasks', urgente: t.priorita === 'alta' })
    }
  })
  adempimentiUrgenti.forEach(a => {
    if (a._gg > 0 && a._gg <= 3) {
      prossimiItems.push({ id: a.id, tipo: 'adempimento', titolo: a.titolo, href: '/admin/adempimenti' })
    }
  })

  const briefing = generateBriefing(firstName, alertCount, tasksCount, riordiniCount, ricorrentiPending, scadutiCount, crmLeadsCount)

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-6">

      {/* Applica visibilità widget prima dell'hydration per evitare il flash */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var h=JSON.parse(localStorage.getItem('dashboard_widgets_hidden')||'[]');h.forEach(function(id){var el=document.getElementById('widget-'+id);if(el)el.style.display='none';});}catch(e){}})();` }} />

      {/* Intestazione */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone uppercase tracking-widest">
          {oggi.charAt(0).toUpperCase() + oggi.slice(1)}
        </p>
        <DashboardPersonalizza />
      </div>

      <QuickActionsBar />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Widget Oggi ── */}
        {oggiItems.length > 0 && (
          <div id="widget-oggi" className="lg:col-span-2">
            <OggiWidget items={oggiItems} />
          </div>
        )}

        {/* ── Prossimi 3 giorni ── */}
        {prossimiItems.length > 0 && (
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-gold/70" />
                <h3 className="text-xs font-medium text-cream uppercase tracking-widest">Prossimi 3 giorni</h3>
              </div>
              <span className="text-[10px] text-stone/40">{prossimiItems.length} element{prossimiItems.length === 1 ? 'o' : 'i'}</span>
            </div>
            <div className="space-y-1">
              {prossimiItems.map(item => (
                <a key={item.id} href={item.href} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-obsidian-light/20 transition-colors group">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.tipo === 'adempimento' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <span className={`flex-1 text-sm truncate ${item.urgente ? 'text-red-400' : 'text-cream/70'} group-hover:text-cream transition-colors`}>
                    {item.titolo}
                  </span>
                  <span className="text-[10px] text-stone/40 capitalize">{item.tipo}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Lina briefing card ── */}
        <div id="widget-lina">
          <LinaBriefingCard
            briefingFallback={briefing}
            firstName={firstName}
            alertCount={alertCount}
            tasksCount={tasksCount}
            riordiniCount={riordiniCount}
            ricorrentiCount={ricorrentiPending}
          />
        </div>

        {/* ── KPI cards ── */}
        <div id="widget-kpi" className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Adempimenti scaduti"
            value={scadutiCount}
            icon={ShieldCheck}
            href="/admin/adempimenti?filter=scaduto"
            alert={scadutiCount > 0}
            note={scadutiCount > 0 ? '⚠ Intervento richiesto' : 'Tutto in regola'}
          />
          <StatCard
            label="Sotto soglia"
            value={alertCount}
            icon={AlertTriangle}
            href="/admin/magazzino?filter=alert"
            alert={alertCount > 0}
            note={alertCount > 0 ? 'Vai al magazzino' : 'Tutto ok'}
          />
          <StatCard
            label="Task aperti"
            value={tasksCount}
            icon={CheckSquare}
            href="/admin/tasks?filter=aperti"
            note={tasksCount > 0 ? 'Gestisci task' : 'Nessun task'}
          />
          <StatCard
            label="Riordini aperti"
            value={riordiniCount}
            icon={Package}
            href="/admin/magazzino?filter=riordini"
            alert={riordiniCount > 0}
            note={riordiniCount > 0 ? 'Da evadere' : 'Nessun riordine'}
          />
          <StatCard
            label="Staff attivo"
            value={staffAll?.length ?? 0}
            icon={Users}
            href="/admin/staff"
            note="Membri"
          />
          <StatCard
            label="Lead CRM"
            value={crmLeadsCount}
            icon={UserPlus}
            href="/admin/crm"
            alert={crmLeadsCount > 0}
            note={crmLeadsCount > 0 ? 'Da contattare' : 'Nessun lead nuovo'}
          />
        </div>

        {/* ── Lead CRM recenti ── */}
        {crmLeadsCount > 0 && (
          <div id="widget-crm" className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-gold/70" />
                <h3 className="text-xs font-medium text-cream uppercase tracking-widest">Nuovi Lead CRM</h3>
              </div>
              <Link href="/admin/crm" className="text-xs text-gold hover:text-gold-light transition-colors">
                Gestisci →
              </Link>
            </div>
            <div className="space-y-1">
              {(crmNuovi ?? []).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-obsidian-light/20 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                  <span className="flex-1 text-sm text-cream/80">
                    {c.nome} {c.cognome}
                  </span>
                  <span className="text-[10px] text-stone/40">
                    {new Date(c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Adempimenti urgenti (scaduti + in scadenza) ── */}
        {adempimentiUrgenti.length > 0 && (
          <div id="widget-scadenze" className="lg:col-span-2">
            <ScadenzeUrgentiWidget adempimenti={adempimentiUrgenti} />
          </div>
        )}

        {/* ── Task & Azioni Ricorrenti spuntabili ── */}
        <div id="widget-tasks" className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-cream uppercase tracking-widest">
              Task & Azioni Ricorrenti
            </h3>
            <div className="flex items-center gap-3">
              <Link href="/admin/ricorrenti" className="text-xs text-stone hover:text-gold transition-colors">Ricorrenti →</Link>
              <Link href="/admin/tasks" className="text-xs text-gold hover:text-gold-light transition-colors">Task →</Link>
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

        {/* ── Riordini aperti (compatto, solo se presenti) ── */}
        {riordiniCount > 0 && (
          <div id="widget-riordini" className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-cream uppercase tracking-widest">
                Richieste Riordino
              </h3>
              <Link href="/admin/magazzino" className="text-xs text-gold hover:text-gold-light transition-colors">
                Evadi nel magazzino →
              </Link>
            </div>
            <div className="space-y-2">
              {(riordiniAperti ?? []).slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-obsidian-light/30 last:border-0">
                  <span className="text-sm text-cream/80">{(r.magazzino as any)?.prodotto ?? '—'}</span>
                  <span className="badge-alert text-xs">Aperta</span>
                </div>
              ))}
              {riordiniCount > 5 && (
                <p className="text-xs text-stone text-center pt-1">
                  +{riordiniCount - 5} altri — <Link href="/admin/magazzino" className="text-gold">vedi tutto</Link>
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, href, alert = false, note,
}: {
  label: string
  value: number
  icon: React.ElementType
  href: string
  alert?: boolean
  note?: string
}) {
  return (
    <Link href={href} className="card hover:border-gold/30 transition-colors group block">
      <div className="flex items-start justify-between mb-2">
        <Icon size={15} className={alert && value > 0 ? 'text-red-400' : 'text-stone/50'} />
        <span className="text-[10px] text-stone/30 group-hover:text-gold/60 transition-colors">→</span>
      </div>
      <p className={`text-3xl font-light font-serif mb-0.5 ${alert && value > 0 ? 'text-red-400' : 'text-cream'}`}>
        {value}
      </p>
      <p className="text-[10px] text-stone uppercase tracking-wider">{label}</p>
      {note && (
        <p className="text-[10px] text-stone/40 mt-1">{note}</p>
      )}
    </Link>
  )
}
