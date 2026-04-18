import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 })

  const adminDb = createAdminClient()

  // Test 1: get current user's profile via admin client
  const { data: myProfile, error: e1 } = await adminDb
    .from('profili').select('id, ruolo').eq('id', user.id).single()

  // Test 2: get ALL admin profiles
  const { data: admins, error: e2 } = await adminDb
    .from('profili').select('id, ruolo').in('ruolo', ['admin'])

  // Test 3: get ALL profiles (limit 5)
  const { data: allProfiles, error: e3 } = await adminDb
    .from('profili').select('id, ruolo').limit(5)

  return NextResponse.json({
    userId: user.id,
    myProfile,
    e1: e1?.message,
    admins,
    adminCount: admins?.length ?? -1,
    e2: e2?.message,
    allProfiles,
    e3: e3?.message,
  })
}
