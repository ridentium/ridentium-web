import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/tasks/[id]/commenti — lista commenti di un task
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from('task_commenti')
    .select('*')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commenti: data ?? [] })
}

// POST /api/tasks/[id]/commenti — aggiunge un commento
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('nome, cognome').eq('id', user.id).single()
  const utente_nome = profilo ? `${profilo.nome} ${profilo.cognome}`.trim() : 'Utente'

  const body = await req.json()
  const { testo } = body

  if (!testo?.trim()) {
    return NextResponse.json({ error: 'Il testo è obbligatorio' }, { status: 400 })
  }

  const { data, error } = await adminDb
    .from('task_commenti')
    .insert({
      task_id: params.id,
      utente_id: user.id,
      utente_nome,
      testo: testo.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commento: data }, { status: 201 })
}

// DELETE /api/tasks/[id]/commenti?commentoId=... — elimina un commento
export async function DELETE(
  req: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const commentoId = searchParams.get('commentoId')
  if (!commentoId) return NextResponse.json({ error: 'commentoId richiesto' }, { status: 400 })

  const adminDb = createAdminClient()

  // Controlla ownership (admin/manager possono eliminare qualsiasi commento)
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  const isAdmin = ['admin', 'manager'].includes(profilo?.ruolo ?? '')

  if (!isAdmin) {
    const { data: commento } = await adminDb
      .from('task_commenti').select('utente_id').eq('id', commentoId).single()
    if (!commento || commento.utente_id !== user.id) {
      return NextResponse.json({ error: 'Non puoi eliminare questo commento' }, { status: 403 })
    }
  }

  const { error } = await adminDb.from('task_commenti').delete().eq('id', commentoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
