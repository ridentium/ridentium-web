import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityServer } from '@/lib/registro-server'
import { createNotifica } from '@/lib/notifiche'

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

  // Prendo il nome dell'utente che crea
  const { data: profilo } = await adminDb
    .from('profili').select('nome, cognome').eq('id', user.id).single()
  const userNome = profilo ? `${profilo.nome} ${profilo.cognome}`.trim() : 'Utente'

  const assegnatoId = assegnato_a || user.id

  const { data, error } = await adminDb
    .from('tasks')
    .insert({
      titolo: titolo.trim(),
      descrizione: descrizione?.trim() || null,
      assegnato_a: assegnatoId,
      creato_da: user.id,
      stato: 'da_fare',
      priorita: priorita || 'media',
      scadenza: scadenza || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[tasks POST]', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }

  // ── Log attività ────────────────────────────────────────────────────────────
  await logActivityServer(
    user.id, userNome,
    'Task creato',
    `"${titolo.trim()}" — priorità ${priorita || 'media'}${scadenza ? ` — scadenza ${scadenza}` : ''}`,
    'tasks'
  )

  // ── Notifica all'assegnatario (se diverso dal creatore) ─────────────────────
  if (assegnatoId !== user.id) {
    await createNotifica({
      user_ids: [assegnatoId],
      tipo: 'task',
      titolo: `Nuovo task assegnato: ${titolo.trim()}`,
      corpo: `Assegnato da ${userNome}${priorita === 'alta' ? ' — ALTA PRIORITÀ' : ''}${scadenza ? ` — Scadenza: ${new Date(scadenza).toLocaleDateString('it-IT')}` : ''}`,
      url: '/admin/tasks',
      push: true,
    }).catch(() => {})
  }

  return NextResponse.json({ task: data }, { status: 201 })
}
