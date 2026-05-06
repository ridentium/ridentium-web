import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/magazzino/storico — ultimi 60 movimenti di magazzino (admin/manager)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const { data, error } = await adminDb
    .from('registro_attivita')
    .select('id, azione, dettaglio, user_nome, created_at')
    .eq('categoria', 'magazzino')
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ storico: data ?? [] })
}
