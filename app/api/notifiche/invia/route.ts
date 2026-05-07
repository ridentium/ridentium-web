import { NextRequest, NextResponse } from 'next/server'
import { createNotifica } from '@/lib/notifiche'
import { requireAuth } from '@/lib/auth-helpers'

const RUOLI_MAP: Record<string, string[]> = {
  tutti:  ['admin', 'staff', 'aso', 'segretaria', 'manager'],
  admin:  ['admin'],
  staff:  ['staff', 'aso', 'segretaria', 'manager'],
}

export async function POST(req: NextRequest) {
  // Solo admin possono inviare messaggi al team
  const auth = await requireAuth(['admin'])
  if (auth instanceof NextResponse) return auth

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
