import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendEmail, EmailTemplate } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
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

  // Carica il contatto
  const { data: contatto, error: dbError } = await supabase
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

  // Invia
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
