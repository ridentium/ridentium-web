import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// ─── Aree consentite ──────────────────────────────────────────────────────────

export type SettingArea = 'dashboard' | 'crm' | 'studio' | 'magazzino'

// ─── Defaults (fallback hardcoded — mai cambiano senza deploy) ────────────────
//
// Se la tabella non esiste, il DB è down, o la chiave non è ancora salvata,
// questi valori garantiscono che dashboard, Lina e CRM continuino a funzionare.

export const SETTING_DEFAULTS: Record<SettingArea, Record<string, unknown>> = {
  dashboard: {
    giorni_stantio:            3,
    giorni_adempimenti_alert:  7,
    giorni_manutenzione_alert: 30,
    max_items_preview:         5,
  },
  crm: {
    giorni_followup_default: 1,
  },
  studio: {
    nome:     '',
    email:    '',
    telefono: '',
  },
  magazzino: {
    giorni_dormiente: 180,
  },
}

// ─── Validatori Zod per chiave (usati nel PUT /api/settings) ─────────────────

export const SETTING_VALIDATORS: Record<SettingArea, Record<string, z.ZodTypeAny>> = {
  dashboard: {
    giorni_stantio:            z.number().int().min(1).max(90),
    giorni_adempimenti_alert:  z.number().int().min(1).max(90),
    giorni_manutenzione_alert: z.number().int().min(7).max(180),
    max_items_preview:         z.number().int().min(3).max(20),
  },
  crm: {
    giorni_followup_default: z.number().int().min(0).max(90),
  },
  studio: {
    nome:     z.string().max(100),
    email:    z.string().max(200).refine(
      v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: 'Email non valida' }
    ),
    telefono: z.string().max(30),
  },
  magazzino: {
    giorni_dormiente: z.number().int().min(30).max(730),
  },
}

// ─── Cache in-memory 60s ──────────────────────────────────────────────────────
//
// Nel runtime Node.js il modulo persiste tra le richieste: la cache funziona.
// Su Vercel serverless può essere cold-start: caso peggiore = 1 query extra.

const _cache = new Map<string, { v: unknown; exp: number }>()
const TTL_MS = 60_000

function _get<T>(k: string): T | undefined {
  const e = _cache.get(k)
  if (!e || Date.now() > e.exp) { _cache.delete(k); return undefined }
  return e.v as T
}

function _set(k: string, v: unknown): void {
  _cache.set(k, { v, exp: Date.now() + TTL_MS })
}

// Invalida tutte le chiavi di un'area (es. 'dashboard:*')
export function invalidateSettingsCache(area?: SettingArea): void {
  if (!area) { _cache.clear(); return }
  const prefix = `${area}:`
  _cache.forEach((_, k) => {
    if (k.startsWith(prefix) || k === area) _cache.delete(k)
  })
}

// ─── getSetting — lettura singola chiave con fallback ─────────────────────────

export async function getSetting<T>(
  area: SettingArea,
  key: string,
  fallback: T,
): Promise<T> {
  const ck = `${area}:${key}`
  const cached = _get<T>(ck)
  if (cached !== undefined) return cached

  try {
    const { data } = await createAdminClient()
      .from('operational_settings')
      .select('value')
      .eq('area', area)
      .eq('key', key)
      .maybeSingle()

    const value = (data?.value ?? fallback) as T
    _set(ck, value)
    return value
  } catch {
    return fallback
  }
}

// ─── getSettingsByArea — lettura intera area con fallback ─────────────────────

export async function getSettingsByArea(
  area: SettingArea,
): Promise<Record<string, unknown>> {
  const ck = area
  const cached = _get<Record<string, unknown>>(ck)
  if (cached !== undefined) return cached

  const defaults = SETTING_DEFAULTS[area] ?? {}

  try {
    const { data } = await createAdminClient()
      .from('operational_settings')
      .select('key, value')
      .eq('area', area)

    const result: Record<string, unknown> = { ...defaults }
    for (const row of data ?? []) {
      result[row.key] = row.value
    }
    _set(ck, result)
    return result
  } catch {
    return { ...defaults }
  }
}

// ─── getAllSettings — tutte le aree per la UI ─────────────────────────────────

export async function getAllSettings(): Promise<Record<SettingArea, Record<string, unknown>>> {
  const [dashboard, crm, studio, magazzino] = await Promise.all([
    getSettingsByArea('dashboard'),
    getSettingsByArea('crm'),
    getSettingsByArea('studio'),
    getSettingsByArea('magazzino'),
  ])
  return { dashboard, crm, studio, magazzino }
}
