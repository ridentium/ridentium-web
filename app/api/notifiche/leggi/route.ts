import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  const auth = await requireAuth('any')
  if (auth instanceof NextResponse) return auth
  const { userId, adminDb } = auth

  const { id, all } = await req.json()

  if (all) {
    const { error } = await adminDb.from('notifiche').update({ letta: true })
      .eq('user_id', userId).eq('letta', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (id) {
    const { error } = await adminDb.from('notifiche').update({ letta: true })
      .eq('id', id).eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
