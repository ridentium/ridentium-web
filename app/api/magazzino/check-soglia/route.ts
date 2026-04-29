import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotifica } from '@/lib/notifiche'

// POST /api/magazzino/check-soglia
// Chiamata internamente quando una quantità scende sotto la soglia minima.
// Invia una push notification agli admin/manager.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { id, prodotto, quantita, soglia_minima } = await req.json()
  if (!prodotto) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })

  try {
    await createNotifica({
      ruoli: ['admin', 'manager'],
      tipo: 'magazzino',
      titolo: `⚠️ Sotto soglia: ${prodotto}`,
      corpo: `Quantità attuale: ${quantita} — soglia minima: ${soglia_minima}. Vai al magazzino per ordinare.`,
      url: '/admin/magazzino?filter=alert',
      push: true,
    })
  } catch (e) {
    console.error('[check-soglia] Notifica failed:', e)
  }

  return NextResponse.json({ ok: true })
}
