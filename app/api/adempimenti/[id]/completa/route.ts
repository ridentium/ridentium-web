import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Calcola la prossima scadenza in base alla frequenza dell'adempimento
function calcolaProssimaScadenza(frequenza: string, dallaData?: string | null): string {
  // Partiamo dalla scadenza attuale (se esiste e non è nel passato), altrimenti da oggi
  const base = dallaData ? new Date(dallaData) : new Date()
  const oggi = new Date()
  const from = base < oggi ? oggi : base // mai retrocedere rispetto ad oggi
  const d = new Date(from)

  switch (frequenza) {
    case 'giornaliero':   d.setDate(d.getDate() + 1);          break
    case 'settimanale':   d.setDate(d.getDate() + 7);           break
    case 'mensile':       d.setMonth(d.getMonth() + 1);         break
    case 'trimestrale':   d.setMonth(d.getMonth() + 3);         break
    case 'semestrale':    d.setMonth(d.getMonth() + 6);         break
    case 'annuale':       d.setFullYear(d.getFullYear() + 1);   break
    case 'biennale':      d.setFullYear(d.getFullYear() + 2);   break
    case 'triennale':     d.setFullYear(d.getFullYear() + 3);   break
    case 'quinquennale':  d.setFullYear(d.getFullYear() + 5);   break
    default:              d.setFullYear(d.getFullYear() + 1);   break
  }

  return d.toISOString().split('T')[0]
}

// POST /api/adempimenti/[id]/completa — registra esecuzione + rinnova automaticamente la scadenza
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { note, evidenza_descrizione, evidenza_url } = body

  // Chiamiamo la RPC per registrare il completamento
  const { data, error } = await supabase.rpc('completa_adempimento', {
    p_adempimento_id: params.id,
    p_note: note || null,
    p_evidenza_descrizione: evidenza_descrizione || null,
    p_evidenza_url: evidenza_url || null,
  })

  if (error) {
    console.error('[completa_adempimento]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Auto-rinnovo: calcola e imposta la prossima scadenza ─────────────────────
  const adminDb = createAdminClient()
  const { data: adempimento } = await adminDb
    .from('adempimenti')
    .select('frequenza, prossima_scadenza')
    .eq('id', params.id)
    .single()

  if (adempimento?.frequenza) {
    const prossimaScadenza = calcolaProssimaScadenza(
      adempimento.frequenza,
      adempimento.prossima_scadenza
    )
    await adminDb
      .from('adempimenti')
      .update({
        prossima_scadenza: prossimaScadenza,
        ultima_esecuzione: new Date().toISOString(),
      })
      .eq('id', params.id)
  }

  return NextResponse.json({ ok: true, result: data })
}
