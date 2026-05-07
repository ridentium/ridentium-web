import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  const auth = await requireAuth('any')
  if (auth instanceof NextResponse) return auth
  const { userId, adminDb } = auth

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100)

  const { data: notifiche } = await adminDb
    .from('notifiche')
    .select('id, tipo, titolo, corpo, url, letta, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  const unreadCount = (notifiche ?? []).filter((n: any) => !n.letta).length
  return NextResponse.json({ notifiche: notifiche ?? [], unreadCount })
}
