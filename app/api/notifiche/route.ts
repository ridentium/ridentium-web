import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100)

  const { data: notifiche } = await adminDb
    .from('notifiche')
    .select('id, tipo, titolo, corpo, url, letta, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  const unreadCount = (notifiche ?? []).filter((n: any) => !n.letta).length
  return NextResponse.json({ notifiche: notifiche ?? [], unreadCount })
}
