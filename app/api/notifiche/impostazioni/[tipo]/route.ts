import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateNotifSettingSchema, zodError } from '@/lib/validation'

// PATCH /api/notifiche/impostazioni/[tipo] — aggiorna impostazioni notifica (solo admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { tipo: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || profilo.ruolo !== 'admin') {
    return NextResponse.json({ error: 'Solo admin può modificare impostazioni notifiche' }, { status: 403 })
  }

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = updateNotifSettingSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const { error } = await adminDb
    .from('notification_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('tipo', params.tipo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
