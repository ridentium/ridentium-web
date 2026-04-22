import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/adempimenti/[id]/completa — registra esecuzione + calcola prossima scadenza
// Tutti gli utenti autenticati possono completare un adempimento.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { note, evidenza_descrizione, evidenza_url } = body

  const adminDb = createAdminClient()
  // Chiamiamo la RPC come service-role; dentro la funzione usiamo auth.uid() via supabase user client
  // per registrare chi ha completato. Però in contesto service-role auth.uid() è NULL, quindi
  // leggiamo manualmente profilo + usiamo il client autenticato per la chiamata.
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

  return NextResponse.json({ ok: true, result: data })
}
