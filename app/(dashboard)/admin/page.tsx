import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Package, CheckSquare, Users, AlertTriangle } from 'lucide-react'
import LinaBriefingCard from '@/components/Dashboard/LinaBriefingCard'
import TasksRicorrentiWidget from '@/components/Dashboard/TasksRicorrentiWidget'

// ── Calcola periodo corrente per ricorrenti ───────────────────────────────────
function getPeriodoKey(frequenza: string): string {
  const now = new Date()
  if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
  if (frequenza === 'settimanale') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() + 1)
    return 'W' + d.toISOString().split('T')[0]
  }
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
}

// ── Genera briefing testuale da dati reali (nessuna chiamata AI) ──────────────
function generateBriefing(
  firstName: string,
  alertCount: number,
  tasksCount: number,
  riordiniCount: number,
  ricorrentiCount: number,
): string {
  const h = new Date().getHours()
  const day = new Date().getDay() // 0=dom, 1=lun, ..., 5=ven, 6=sab
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const isLunedi = day === 1
  const isVenerdi = day === 5

  const urgenze: string[] = []
  if (alertCount > 0) urgenze.push(`${alertCount} prodott${alertCount === 1 ? 'o' : 'i'} sotto soglia`)
  if (tasksCount > 0) urgenze.push(`${tasksCount} task apert${tasksCount === 1 ? 'o' : 'i'}`)
  if (riordiniCount > 0) urgenze.push(`${riordiniCount} riordine${riordiniCount === 1 ? '' : 'i'} da evadere`)

  if (urgenze.length === 0 && ricorrentiCount === 0) {
    const chiusura = isVenerdi
      ? 'Ottimo momento per chiudere la settimana in bellezza!'
      : isLunedi
      ? 'Buona settimana — tutto in ordine per iniziare bene.'
      : 'Nessuna urgenza, buona giornata!'
    return `${saluto} ${firstName}! Tutto sotto controllo: nessuna scorta in esaurimento, nessun task aperto. ${chiusura}`
  }

  const intro = isLunedi
    ? `${saluto} ${firstName}, nuova settimana!`
    : isVenerdi
    ? `${saluto} ${firstName}, ultimi task prima del weekend.`
    : `${saluto} ${firstName}.`

  if (urgenze.length === 0) {
    return `${intro} Hai ${ricorrentiCount} azion${ricorrentiCount === 1 ? 'e ricorrente' : 'i ricorrenti'} ancora da completare oggi.`
  }

  const lista = urgenze.join(', ')
  const priorita = alertCount > 0
    ? 'Dai un\'occhiata al magazzino per prima cosa.'
    : tasksCount > 0
    ? 'Hai task in attesa — parti da quelli urgenti.'
    : 'Ci sono riordini da evadere nel magazzino.'

  const extra = ricorrentiCount > 0
    ? ` Inoltre ${ricorrentiCount} azion${ricorrentiCount === 1 ? 'e ricorrente' : 'i ricorrenti'} non ancora completat${ricorrentiCount === 1 ? 'a' : 'e'}.`
    : ''

  return `${intro} Oggi hai ${lista}.${extra} ${priorita}`
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
  ] = await Promise.all([
    supabase.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria'),
    supabase.from('tasks').select('id, titolo, priorita, scadenza, assegnato_a, stato').neq('stato', 'completato'),
    supabase.from('profili').select('id').eq('attivo', true),
    supabase.from('riordini').select('id, created_at, magazzino(prodotto)').eq('stato', 'aperta'),
    supabase.from('ricorrenti').select('*').eq('attiva', true).order('created_at', { ascending: true }),
    adminDb.from('profili').select('nome, cognome').eq('id', user!.id).single(),
  ])

  const alertCount = (magazzinoAll ?? []).filter((i: any) => i.quantita < i.soglia_minima).length
  const tasksCount = tasksOpen?.length ?? 0
  const riordiniCount = riordiniAperti?.length ?? 0
  const userNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()
  const firstName = profilo?.nome ?? 'Mariano'

  // Ricorrenti non ancora completate per il periodo corrente
  const ricorrentiPending = (ricorrenti ?? []).filter((r: any) => {
    const key = getPeriodoKey(r.frequenza)
    return !((r.completamenti ?? []).some((c: any) => c.periodoKey === key))
  }).length

  const briefing = generateBriefing(firstName, alertCount, tasksCount, riordiniCount, ricorrentiPending)

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-6">

      {/* Intestazione discreta */}
      <div>
        <p className="text-xs text-stone uppercase tracking-widest">
          {oggi.charAt(0).toUpperCase() + oggi.slice(1)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Lina briefing card ── */}
        <LinaBriefingCard
          briefing={briefing}
          alertCount={alertCount}
          tasksCount={tasksCount}
          riordiniCount={riordiniCount}
          ricorrentiCount={ricorrentiPending}
        />

        {/* ── KPI cards ── */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Sotto soglia"
            value={alertCount}
            icon={AlertTriangle}
            href="/admin/magazzino"
            alert={alertCount > 0}
            note={alertCount > 0 ? 'Vai al magazzino' : 'Tutto ok'}
          />
          <StatCard
            label="Task aperti"
            value={tasksCount}
            icon={CheckSquare}
            href="/admin/tasks"
            note={tasksCount > 0 ? 'Gestisci task' : 'Nessun task'}
          />
          <StatCard
            label="Riordini aperti"
            value={riordiniCount}
            icon={Package}
            href="/admin/magazzino"
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
        </div>

        {/* ── Task & Azioni Ricorrenti spuntabili ── */}
        <div className="card lg:col-span-2">
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
          <div className="card lg:col-span-2">
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
