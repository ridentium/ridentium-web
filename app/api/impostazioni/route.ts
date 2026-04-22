import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('impostazioni_studio')
    .select('chiave,valore')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result: Record<string, unknown> = {}
  for (const row of data ?? []) result[row.chiave] = row.valore
  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profilo } = await supabase
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await request.json()
  const upserts = Object.entries(body).map(([chiave, valore]) => ({
    chiave,
    valore,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('impostazioni_studio')
    .upsert(upserts, { onConflict: 'chiave' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
