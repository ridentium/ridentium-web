import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertNotifPrefSchema, zodError } from '@/lib/validation'

// GET /api/profilo/preferenze — legge le preferenze notifica dell'utente corrente
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('user_notification_prefs')
    .select('tipo, abilitata')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prefs: data ?? [] })
}

// POST /api/profilo/preferenze — upsert preferenza notifica per l'utente corrente
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rawBody = await req.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const parsed = upsertNotifPrefSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(zodError(parsed), { status: 400 })
  }

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from('user_notification_prefs')
    .upsert(
      { user_id: user.id, tipo: parsed.data.tipo, abilitata: parsed.data.abilitata, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,tipo' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
