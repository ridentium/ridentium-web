import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, all } = await req.json()
  const adminDb = createAdminClient()

  if (all) {
    await adminDb.from('notifiche').update({ letta: true })
      .eq('user_id', user.id).eq('letta', false)
  } else if (id) {
    await adminDb.from('notifiche').update({ letta: true })
      .eq('id', id).eq('user_id', user.id)
  }
  return NextResponse.json({ ok: true })
}
