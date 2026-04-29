import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/tasks — crea un nuovo task
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()

  const body = await req.json()
  const { titolo, descrizione, assegnato_a, priorita, scadenza } = body

  if (!titolo?.trim()) {
    return NextResponse.json({ error: 'Il titolo è obbligatorio' }, { status: 400 })
  }

  const { data, error } = await adminDb
    .from('tasks')
    .insert({
      titolo: titolo.trim(),
      descrizione: descrizione?.trim() || null,
      assegnato_a: assegnato_a || user.id,
      creato_da: user.id,
      stato: 'da_fare',
      priorita: priorita || 'media',
      scadenza: scadenza || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[tasks POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data }, { status: 201 })
}
