import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { silenziaMagazzinoSchema, zodError } from '@/lib/validation'

// POST /api/magazzino/[id]/silenzia — silenzia o riattiva l'alert di un prodotto (admin/manager)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = silenziaMagazzinoSchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json(zodError(parsed), { status: 400 })

  const { silenziato, motivo } = parsed.data

  // Compone il payload di aggiornamento
  const updatePayload = silenziato
    ? {
        alert_silenziato:        true,
        alert_silenziato_motivo: motivo ?? null,
        alert_silenziato_at:     new Date().toISOString(),
        alert_silenziato_by:     user.id,
        updated_at:              new Date().toISOString(),
      }
    : {
        alert_silenziato:        false,
        alert_silenziato_motivo: null,
        alert_silenziato_at:     null,
        alert_silenziato_by:     null,
        updated_at:              new Date().toISOString(),
      }

  const { data, error } = await adminDb
    .from('magazzino')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log attività
  const azione = silenziato ? 'Alert magazzino silenziato' : 'Alert magazzino riattivato'
  const dettaglio = motivo
    ? `${data.prodotto} — ${motivo}`
    : data.prodotto
  await logActivityServer(user.id, userNome, azione, dettaglio, 'magazzino')

  return NextResponse.json({ item: data })
}
