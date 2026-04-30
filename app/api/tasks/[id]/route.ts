import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { createNotifica } from '@/lib/notifiche'

// PATCH /api/tasks/[id] — modifica un task
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()

  // Fetch profilo con ruolo E nome per il log
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })

  const isAdmin = ['admin', 'manager'].includes(profilo.ruolo)
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // Leggi il task corrente (serve per auth check, log e notifiche)
  const { data: taskCorrente } = await adminDb
    .from('tasks').select('titolo, stato, assegnato_a, creato_da').eq('id', params.id).single()

  if (!isAdmin) {
    if (!taskCorrente || (taskCorrente.assegnato_a !== user.id && taskCorrente.creato_da !== user.id)) {
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

  // ── Log attività ─────────────────────────────────────────────────────────────
  const cambiati: string[] = []
  if ('titolo' in updates) cambiati.push(`titolo: "${updates.titolo}"`)
  if ('stato' in updates) cambiati.push(`stato → ${updates.stato}`)
  if ('priorita' in updates) cambiati.push(`priorità → ${updates.priorita}`)
  if ('assegnato_a' in updates) cambiati.push('riassegnato')
  if ('scadenza' in updates) cambiati.push(`scadenza → ${updates.scadenza ?? 'rimossa'}`)
  await logActivityServer(
    user.id, userNome,
    'Task aggiornato',
    `"${taskCorrente?.titolo ?? data.titolo}" — ${cambiati.join(', ') || 'nessuna variazione'}`,
    'tasks'
  )

  // ── Notifica al nuovo assegnatario (se cambia) ────────────────────────────────
  if (
    'assegnato_a' in updates &&
    updates.assegnato_a &&
    updates.assegnato_a !== user.id &&
    updates.assegnato_a !== taskCorrente?.assegnato_a
  ) {
    await createNotifica({
      user_ids: [updates.assegnato_a as string],
      tipo: 'task',
      titolo: `Task assegnato a te: ${data.titolo}`,
      corpo: `Riassegnato da ${userNome}`,
      url: '/admin/tasks',
      push: true,
    }).catch((err) => { console.error('[notify] riassegnazione task:', err) })
  }

  // ── Notifica al creatore quando completato da qualcun altro ──────────────────
  if (
    updates.stato === 'completato' &&
    taskCorrente?.stato !== 'completato' &&
    taskCorrente?.creato_da &&
    taskCorrente.creato_da !== user.id
  ) {
    await createNotifica({
      user_ids: [taskCorrente.creato_da],
      tipo: 'task',
      titolo: `Task completato: ${data.titolo}`,
      corpo: `Completato da ${userNome}`,
      url: '/admin/tasks',
      push: true,
    }).catch((err) => { console.error('[notify] completamento task:', err) })
  }

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
    .from('profili').select('ruolo, nome, cognome').eq('id', user.id).single()
  if (!profilo) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })

  const isAdmin = ['admin', 'manager'].includes(profilo.ruolo)
  const userNome = `${profilo.nome} ${profilo.cognome}`.trim()

  // Leggi il task prima di eliminarlo (per log e auth check)
  const { data: taskDaEliminare } = await adminDb
    .from('tasks').select('titolo, creato_da, assegnato_a').eq('id', params.id).single()

  if (!isAdmin) {
    if (!taskDaEliminare || (taskDaEliminare.creato_da !== user.id && taskDaEliminare.assegnato_a !== user.id)) {
      return NextResponse.json({ error: 'Non puoi eliminare questo task' }, { status: 403 })
    }
  }

  const { error } = await adminDb
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Errore durante l\'eliminazione' }, { status: 500 })

  await logActivityServer(
    user.id, userNome,
    'Task eliminato',
    `"${taskDaEliminare?.titolo ?? params.id}"`,
    'tasks'
  )

  return NextResponse.json({ ok: true })
}
