import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, EmailTemplate } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const adminDb  = createAdminClient()

  // Use getUser() (verifies JWT) instead of getSession() (just reads cookie)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Role gate: solo admin/manager possono inviare email dal CRM
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  let body: {
    contattoId: string
    template: EmailTemplate
    customSubject?: string
    customBody?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { contattoId, template, customSubject, customBody } = body

  if (!contattoId || !template) {
    return NextResponse.json({ error: 'contattoId e template sono obbligatori' }, { status: 400 })
  }

  // Carica il contatto (usa admin per bypassare RLS; abbiamo già verificato ruolo)
  const { data: contatto, error: dbError } = await adminDb
    .from('crm_contatti')
    .select('id, nome, email')
    .eq('id', contattoId)
    .single()

  if (dbError || !contatto) {
    return NextResponse.json({ error: 'Contatto non trovato' }, { status: 404 })
  }

  if (!contatto.email) {
    return NextResponse.json({ error: 'Il contatto non ha un indirizzo email' }, { status: 400 })
  }

  const result = await sendEmail({
    to: contatto.email,
    nome: contatto.nome ?? '',
    template,
    customSubject,
    customBody,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Invio fallito' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
