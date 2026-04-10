import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/ordini/[id]
// Gestisce: ricezione (totale/parziale) e annullamento ordine.
// Usa il client admin per bypassare RLS — il client browser non ha permessi di scrittura su ordini.

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

  const body = await req.json()
  const { action } = body

  // ── Ricezione ordine ───────────────────────────────────────────────────────
  if (action === 'ricevi') {
    const { tipo, quantitaRicevute, note, righe } = body

    const nuovoStato = tipo === 'totale' ? 'ricevuto' : 'parziale'

    for (const riga of righe) {
      const qty = quantitaRicevute[riga.id] ?? 0
      if (qty > 0 && riga.magazzino_id) {
        const { data: item } = await adminDb
          .from('magazzino').select('quantita').eq('id', riga.magazzino_id).single()
        if (item) {
          await adminDb.from('magazzino')
            .update({ quantita: (item.quantita ?? 0) + qty })
            .eq('id', riga.magazzino_id)
        }
      }
      await adminDb.from('ordini_righe')
        .update({ quantita_ricevuta: qty })
        .eq('id', riga.id)
    }

    const updates = {
      stato: nuovoStato,
      note: note || null,
      data_ricezione: new Date().toISOString(),
    }
    const { error } = await adminDb.from('ordini').update(updates).eq('id', params.id)
    if (error) {
      for (const riga of righe) {
        const qty = quantitaRicevute[riga.id] ?? 0
        if (qty > 0 && riga.magazzino_id) {
          const { data: item } = await adminDb
            .from('magazzino').select('quantita').eq('id', riga.magazzino_id).single()
          if (item) {
            await adminDb.from('magazzino')
              .update({ quantita: Math.max(0, (item.quantita ?? 0) - qty) })
              .eq('id', riga.magazzino_id)
          }
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updates })
  }

  // ── Annullamento ordine ────────────────────────────────────────────────────
  if (action === 'annulla') {
    const { note, statoCorrente, righe } = body

    if (statoCorrente === 'parziale' || statoCorrente === 'ricevuto') {
      for (const riga of righe) {
        const qtyToSubtract =
          riga.quantita_ricevuta != null
            ? riga.quantita_ricevuta
            : statoCorrente === 'ricevuto' ? riga.quantita_ordinata : 0
        if (qtyToSubtract > 0 && riga.magazzino_id) {
          const { data: item } = await adminDb
            .from('magazzino').select('quantita').eq('id', riga.magazzino_id).single()
          if (item) {
            await adminDb.from('magazzino')
              .update({ quantita: Math.max(0, (item.quantita ?? 0) - qtyToSubtract) })
              .eq('id', riga.magazzino_id)
          }
        }
      }
    }

    const updates = { stato: 'annullato', note: note || null }
    const { error } = await adminDb.from('ordini').update(updates).eq('id', params.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updates })
  }

  return NextResponse.json({ error: 'Azione non riconosciuta' }, { status: 400 })
}
