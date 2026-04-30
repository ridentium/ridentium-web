import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AiChatPage from '@/components/AI/AiChatPage'
import { getPeriodoKey } from '@/lib/periodo'

export default async function AIPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profilo },
    { data: sessioni },
    { data: magazzinoAlert },
    { data: tasksOpen },
    { data: riordini },
    { data: ricorrenti },
  ] = await Promise.all([
    adminDb.from('profili').select('nome, cognome, ruolo').eq('id', user!.id).single(),
    adminDb.from('ai_sessioni')
      .select('id, titolo, created_at, updated_at')
      .eq('utente_id', user!.id)
      .order('updated_at', { ascending: false })
      .limit(20),
    // Prodotti sotto soglia — ordinati per gravità (quantita più bassa prima)
    supabase.from('magazzino')
      .select('id, prodotto, quantita, soglia_minima, categoria')
      .filter('quantita', 'lt', 'soglia_minima'),   // non supportato direttamente
    supabase.from('tasks')
      .select('id, titolo, priorita, scadenza')
      .neq('stato', 'completato')
      .order('priorita', { ascending: false })
      .order('scadenza', { ascending: true }),
    supabase.from('riordini')
      .select('id, created_at, magazzino(prodotto)')
      .eq('stato', 'aperta')
      .order('created_at', { ascending: false }),
    supabase.from('ricorrenti')
      .select('id, titolo, frequenza, completamenti')
      .eq('attiva', true),
  ])

  const userName = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()
  const userRole = profilo?.ruolo ?? 'aso'

  // Scorte sotto soglia (calcolo client-side perché Supabase non supporta filtri colonna-colonna)
  // Passiamo direttamente tutti i dati alla pagina e filtriamo lì — o usiamo query separata
  const [{ data: mag2 }] = await Promise.all([
    supabase.from('magazzino').select('id, prodotto, quantita, soglia_minima, categoria'),
  ])
  const alertItems = (mag2 ?? [])
    .filter((i: any) => i.quantita < i.soglia_minima)
    .sort((a: any, b: any) => (a.quantita / a.soglia_minima) - (b.quantita / b.soglia_minima)) // più grave prima

  // Ricorrenti non completate oggi
  const ricorrentiPending = (ricorrenti ?? []).filter((r: any) => {
    const key = getPeriodoKey(r.frequenza)
    return !((r.completamenti ?? []).some((c: any) => c.periodoKey === key))
  })

  // Bacheca priorità: ordine logico
  const bacheca = [
    ...alertItems.slice(0, 5).map((i: any) => ({
      tipo: 'scorta' as const,
      priorita: 3,
      titolo: i.prodotto,
      dettaglio: `${i.quantita}/${i.soglia_minima} ${i.quantita === 0 ? '— ESAURITO' : '— sotto soglia'}`,
    })),
    ...(tasksOpen ?? [])
      .filter((t: any) => t.priorita === 'alta')
      .slice(0, 3)
      .map((t: any) => ({
        tipo: 'task' as const,
        priorita: 2,
        titolo: t.titolo,
        dettaglio: t.scadenza ? `Scade il ${new Date(t.scadenza).toLocaleDateString('it-IT')}` : 'Task urgente',
      })),
    ...(riordini ?? []).slice(0, 3).map((r: any) => ({
      tipo: 'riordine' as const,
      priorita: 2,
      titolo: (r.magazzino as any)?.prodotto ?? 'Prodotto',
      dettaglio: 'Riordine da evadere',
    })),
    ...ricorrentiPending.slice(0, 3).map((r: any) => ({
      tipo: 'ricorrente' as const,
      priorita: 1,
      titolo: r.titolo,
      dettaglio: `Azione ${r.frequenza} in sospeso`,
    })),
    ...(tasksOpen ?? [])
      .filter((t: any) => t.priorita !== 'alta')
      .slice(0, 3)
      .map((t: any) => ({
        tipo: 'task' as const,
        priorita: 1,
        titolo: t.titolo,
        dettaglio: t.priorita === 'media' ? 'Priorità media' : 'Priorità bassa',
      })),
  ]

  return (
    <div className="h-[calc(100vh-theme(spacing.24))] flex flex-col">
      <AiChatPage
        userName={userName}
        userRole={userRole}
        userId={user!.id}
        storico={sessioni ?? []}
        bacheca={bacheca}
      />
    </div>
  )
}
