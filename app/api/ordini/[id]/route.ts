import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'

// PATCH /api/ordini/[id]
// Gestisce: ricezione (totale/parziale) e annullamento ordine.
// Usa le RPC Postgres (ricevi_ordine_tx / annulla_ordine_tx) create nella
// migrazione 20260422 per fare aggiornamento di ordine + righe + magazzino
// in UN'UNICA transazione. Questo chiude il bug "lost update" dei duplicati
// ordini (aprile 2026): due ricezioni concorrenti non si sovrascrivono più.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Role gate: solo admin / manager / segretaria possono ricevere/annullare ordini
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // Recupera fornitore_nome per i log (non fatale se manca)
  const { data: ordineInfo } = await adminDb
    .from('ordini').select('fornitore_nome').eq('id', params.id).single()
  const fornitoreNome = ordineInfo?.fornitore_nome ?? ''

  const body = await req.json()
  const { action } = body

  // ── Ricezione ordine ───────────────────────────────────────────────────────
  if (action === 'ricevi') {
    const { tipo, quantitaRicevute, note, righe } = body as {
      tipo: 'totale' | 'parziale'
      quantitaRicevute: Record<string, number>
      note?: string
      righe: Array<{ id: string; magazzino_id?: string | null }>
    }

    // Costruisce il JSON da passare alla RPC
    const righeTx = righe.map(r => ({
      id: r.id,
      qty: Number(quantitaRicevute[r.id] ?? 0),
      magazzino_id: r.magazzino_id ?? null,
    }))

    const { data, error } = await adminDb.rpc('ricevi_ordine_tx', {
      p_ordine_id: params.id,
      p_righe: righeTx,
      p_note: note || null,
      p_tipo: tipo,
    })

    if (error) {
      console.error('[ordini ricevi] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const statoLabel = tipo === 'totale' ? 'ricevuto' : 'parz. ricevuto'
    await logActivityServer(user.id, userNome, `Ordine ${statoLabel}: ${fornitoreNome}`, undefined, 'ordini')

    return NextResponse.json({
      ok: true,
      updates: {
        stato: tipo === 'totale' ? 'ricevuto' : 'parziale',
        note: note || null,
        data_ricezione: (data as any)?.data_ricezione ?? new Date().toISOString(),
      },
    })
  }

  // ── Annullamento ordine ────────────────────────────────────────────────────
  if (action === 'annulla') {
    const { note, statoCorrente, righe } = body as {
      note?: string
      statoCorrente: string
      righe: Array<{
        id: string
        magazzino_id?: string | null
        quantita_ricevuta?: number | null
        quantita_ordinata?: number
      }>
    }

    // Per l'annullamento, se lo stato corrente è 'ricevuto'/'parziale',
    // la qty da scalare è `quantita_ricevuta` (se presente) oppure `quantita_ordinata`
    const righeTx = (righe || []).map(r => ({
      id: r.id,
      qty: Number(
        r.quantita_ricevuta != null
          ? r.quantita_ricevuta
          : statoCorrente === 'ricevuto' ? (r.quantita_ordinata ?? 0) : 0
      ),
      magazzino_id: r.magazzino_id ?? null,
    }))

    const { error } = await adminDb.rpc('annulla_ordine_tx', {
      p_ordine_id: params.id,
      p_righe: righeTx,
      p_note: note || null,
      p_stato_corrente: statoCorrente || 'inviato',
    })

    if (error) {
      console.error('[ordini annulla] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const annullaLabel = statoCorrente === 'ricevuto'
      ? `Ricezione annullata: ${fornitoreNome}`
      : `Ordine annullato: ${fornitoreNome}`
    await logActivityServer(user.id, userNome, annullaLabel, undefined, 'ordini')

    return NextResponse.json({
      ok: true,
      updates: { stato: 'annullato', note: note || null },
    })
  }

  // ── Ripristino ricezione (annulla ricezione → torna inviato) ──────────────
  // Usa ripristina_ricezione_tx per eseguire l'operazione in modo atomico:
  // scala le quantità dal magazzino E aggiorna lo stato ordine in una sola transazione.
  if (action === 'ripristina_ricezione') {
    const { note, righe } = body as {
      note?: string
      righe: Array<{ id: string; magazzino_id?: string | null; quantita_ricevuta?: number | null; quantita_ordinata?: number }>
    }

    // Costruisce il JSON per la RPC
    const righeTx = (righe ?? []).map(r => ({
      magazzino_id: r.magazzino_id ?? null,
      qty: Number(r.quantita_ricevuta ?? r.quantita_ordinata ?? 0),
    }))

    const { error } = await adminDb.rpc('ripristina_ricezione_tx', {
      p_ordine_id: params.id,
      p_righe:     righeTx,
      p_note:      note || null,
    })

    if (error) {
      console.error('[ordini ripristina_ricezione] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivityServer(user.id, userNome, `Ricezione annullata (ordine ripristinato): ${fornitoreNome}`, undefined, 'ordini')

    return NextResponse.json({
      ok: true,
      updates: { stato: 'inviato', data_ricezione: null, note: note || null },
    })
  }

  // ── Cambio stato semplice (inviato → confermato_fornitore → in_consegna) ──
  if (action === 'cambia_stato') {
    const { stato } = body as { stato: string }
    const STATI_VALIDI = ['inviato', 'confermato_fornitore', 'in_consegna']
    if (!STATI_VALIDI.includes(stato)) {
      return NextResponse.json({ error: 'Stato non valido' }, { status: 400 })
    }
    const { error } = await adminDb
      .from('ordini').update({ stato }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const STATO_LABEL_MAP: Record<string, string> = {
      confermato_fornitore: 'confermato fornitore',
      in_consegna:          'in consegna',
      inviato:              'inviato',
    }
    await logActivityServer(user.id, userNome, `Ordine ${STATO_LABEL_MAP[stato] ?? stato}: ${fornitoreNome}`, undefined, 'ordini')

    return NextResponse.json({ ok: true, updates: { stato } })
  }

  return NextResponse.json({ error: 'Azione non riconosciuta' }, { status: 400 })
}
