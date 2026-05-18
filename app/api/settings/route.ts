import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  getAllSettings,
  invalidateSettingsCache,
  SETTING_VALIDATORS,
  type SettingArea,
} from '@/lib/settings'
import { logActivityServer } from '@/lib/registro-server'

// ── GET /api/settings ─────────────────────────────────────────────────────────
// Restituisce tutti i settings con fallback ai default.
// Accessibile da qualsiasi utente autenticato (lettura).

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Opzionale: filtra per area singola (?area=dashboard)
  const { searchParams } = new URL(req.url)
  const areaFilter = searchParams.get('area') as SettingArea | null

  try {
    const all = await getAllSettings()
    const payload = areaFilter ? { [areaFilter]: all[areaFilter] ?? {} } : all
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Errore nel recupero settings' }, { status: 500 })
  }
}

// ── PUT /api/settings ─────────────────────────────────────────────────────────
// Aggiorna un singolo setting. Solo admin/manager.
// Body: { area: string, key: string, value: unknown }

const PUT_SCHEMA = z.object({
  area:  z.enum(['dashboard', 'crm', 'studio']),
  key:   z.string().min(1).max(60),
  value: z.unknown(),
})

export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('nome, cognome, ruolo')
    .eq('id', user.id)
    .single()

  if (!profilo || !['admin', 'manager'].includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato — richiesto ruolo admin/manager' }, { status: 403 })
  }

  // ── Validazione body ──────────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const parsed = PUT_SCHEMA.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload non valido', dettagli: parsed.error.flatten() }, { status: 422 })
  }

  const { area, key, value } = parsed.data

  // ── Validazione valore per chiave specifica ────────────────────────────────
  const areaValidators = SETTING_VALIDATORS[area]
  if (!areaValidators) {
    return NextResponse.json({ error: `Area sconosciuta: ${area}` }, { status: 422 })
  }

  const validator = areaValidators[key]
  if (!validator) {
    return NextResponse.json({ error: `Chiave non consentita: ${area}.${key}` }, { status: 422 })
  }

  const valueResult = validator.safeParse(value)
  if (!valueResult.success) {
    return NextResponse.json(
      { error: `Valore non valido per ${area}.${key}`, dettagli: valueResult.error.flatten() },
      { status: 422 }
    )
  }

  // ── Upsert DB ──────────────────────────────────────────────────────────────
  const { error: dbError } = await adminDb
    .from('operational_settings')
    .upsert(
      { area, key, value: valueResult.data as Parameters<typeof JSON.parse>[0], updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'area,key' }
    )

  if (dbError) {
    console.error('[settings PUT] DB error:', dbError)
    return NextResponse.json({ error: 'Errore salvataggio setting' }, { status: 500 })
  }

  // ── Invalida cache ─────────────────────────────────────────────────────────
  invalidateSettingsCache(area)

  // ── Log attività ──────────────────────────────────────────────────────────
  const nomeUtente = `${profilo.nome} ${profilo.cognome}`.trim()
  await logActivityServer(
    user.id,
    nomeUtente,
    `Setting aggiornato: ${area}.${key} = ${JSON.stringify(valueResult.data)}`,
    `Area: ${area} | Chiave: ${key} | Valore: ${JSON.stringify(valueResult.data)}`,
    'sistema',
  )

  return NextResponse.json({ ok: true, area, key, value: valueResult.data })
}
