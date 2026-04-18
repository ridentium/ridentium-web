import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createNotifica } from '@/lib/notifiche'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 })

  const adminDb = createAdminClient()

  // Step 1: resolve IDs exactly like createNotifica does
  const ruoli = ['admin']
  let targetIds: string[] = []
  const { data: profiliData, error: profiliErr } = await adminDb
    .from('profili').select('id').in('ruolo', ruoli)
  targetIds = profiliData?.map((r: { id: string }) => r.id) ?? []

  // Step 2: try insert
  let insertResult = null
  let insertError = null
  if (targetIds.length > 0) {
    const rows = targetIds.map(uid => ({
      user_id: uid,
      tipo: 'messaggio',
      titolo: 'Test debug notifica',
      corpo: 'Questo è un test diretto',
      url: '/admin/notifiche',
      letta: false,
    }))
    const { data: ins, error: ie } = await adminDb.from('notifiche').insert(rows).select()
    insertResult = ins
    insertError = ie?.message
  }

  // Step 3: call createNotifica directly
  const notifResult = await createNotifica({
    user_ids: [user.id],
    tipo: 'messaggio',
    titolo: 'Test via createNotifica(user_ids)',
    corpo: 'Test con user_ids diretto',
    url: '/admin/notifiche',
    push: false,
  })

  return NextResponse.json({
    userId: user.id,
    targetIds,
    profiliErr: profiliErr?.message,
    insertResult,
    insertError,
    notifResult,
  })
}
