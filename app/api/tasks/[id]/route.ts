import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/tasks/[id] — modifica un task
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()

  // Verifica che l'utente possa modificare questo task:
  // admin/manager possono modificare tutto; gli altri solo i propri
  if (!profilo) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })

  const isAdmin = ['admin', 'manager'].includes(profilo.ruolo)

  if (!isAdmin) {
    // Controlla che il task sia assegnato a questo utente
    const { data: task } = await adminDb
      .from('tasks').select('assegnato_a, creato_da').eq('id', params.id).single()
    if (!task || (task.assegnato_a !== user.id && task.creato_da !== user.id)) {
      return NextResponse.json({ error: 'Non puoi modificare questo task' }, { status: 403 })
    }
  }

  const body = await req.json()
  const allowed = ['titolo', 'descrizione', 'stato', 'priorita', 'scadenza', 'assegnato_a']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in body) updates[k] = body[k]

  // Staff non può riassegnare ad altri
  if (!isAdmin && 'assegnato_a' in updates) {
    delete updates.assegnato_a
  }

  const { data, error } = await adminDb
    .from('tasks').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ task: data })
}

// DELETE /api/tasks/[id] — elimina un task
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })

  const isAdmin = ['admin', 'manager'].includes(profilo.ruolo)

  if (!isAdmin) {
    const { data: task } = await adminDb
      .from('tasks').select('creato_da, assegnato_a').eq('id', params.id).single()
    if (!task || (task.creato_da !== user.id && task.assegnato_a !== user.id)) {
      return NextResponse.json({ error: 'Non puoi eliminare questo task' }, { status: 403 })
    }
  }

  const { error } = await adminDb.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
