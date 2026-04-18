import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotifica } from '@/lib/notifiche'

const RUOLI_MAP: Record<string, string[]> = {
  tutti:  ['admin', 'staff', 'aso', 'segretaria', 'manager'],
  admin:  ['admin'],
  staff:  ['staff', 'aso', 'segretaria', 'manager'],
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profilo } = await supabase
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (profilo?.ruolo !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { titolo, corpo, url, destinatari = 'tutti' } = await req.json()
  if (!titolo?.trim())
    return NextResponse.json({ error: 'Titolo richiesto' }, { status: 400 })

  const result = await createNotifica({
    ruoli: RUOLI_MAP[destinatari] ?? RUOLI_MAP.tutti,
    tipo: 'messaggio',
    titolo: titolo.trim(),
    corpo: corpo?.trim(),
    url: url || '/admin/notifiche',
    push: true,
  })
  return NextResponse.json({ ok: true, ...result })
}
