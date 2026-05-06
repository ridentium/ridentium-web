import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/fornitori/[id]/contatti/[cid]/predefinito — imposta contatto come predefinito (admin/manager)
// Atomicamente: de-seleziona tutti, poi seleziona quello richiesto.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string; cid: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  // Reset tutti i contatti del fornitore
  const { error: resetErr } = await adminDb
    .from('fornitore_contatti')
    .update({ is_predefinito: false })
    .eq('fornitore_id', params.id)
  if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 })

  // Imposta il contatto selezionato come predefinito
  const { error } = await adminDb
    .from('fornitore_contatti')
    .update({ is_predefinito: true })
    .eq('id', params.cid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
