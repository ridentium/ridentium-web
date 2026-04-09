import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/subscribe — save push subscription
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const subscription = await req.json() as PushSubscription
    const { endpoint, keys } = subscription.toJSON ? subscription.toJSON() : (subscription as any)

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const adminDb = createAdminClient()

    // Get user's role
    const { data: profilo } = await adminDb
      .from('profili')
      .select('ruolo')
      .eq('id', user.id)
      .single()

    // Upsert by endpoint (unique)
    const { error } = await adminDb
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          ruolo: profilo?.ruolo ?? 'staff',
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('Subscribe upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/subscribe — remove push subscription
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint } = await req.json()
    const adminDb = createAdminClient()

    await adminDb
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
