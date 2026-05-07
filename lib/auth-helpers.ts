/**
 * auth-helpers.ts
 * Helper centralizzato per autenticazione e autorizzazione nelle API Route Handlers.
 *
 * Elimina il blocco boilerplate di 8 righe ripetuto in ogni route:
 *   const supabase = createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *   if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
 *   const adminDb = createAdminClient()
 *   const { data: profilo } = await adminDb.from('profili')...
 *   if (!profilo || !allowedRoles.includes(profilo.ruolo)) return 403
 *
 * Uso:
 *   const auth = await requireAuth(['admin', 'manager'])
 *   if (auth instanceof NextResponse) return auth
 *   const { userId, profilo, adminDb } = auth
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Ruoli definiti nel sistema RIDENTIUM
export type RuoloStudio =
  | 'admin'
  | 'manager'
  | 'staff'
  | 'aso'
  | 'segreteria'
  | 'segretaria' // alias legacy — unificare in futuro
  | 'clinico'

export interface AuthContext {
  userId: string
  userEmail: string
  profilo: {
    ruolo: string
    nome: string | null
    cognome: string | null
  }
  /** Nome completo dell'utente per i log attivita */
  nomeCompleto: string
  /** adminDb: client con service role key — bypassa RLS. Usare con cura. */
  adminDb: ReturnType<typeof createAdminClient>
}

/**
 * Verifica autenticazione e ruolo dell'utente corrente.
 *
 * @param allowedRoles - Ruoli autorizzati. Usare 'any' per accettare qualsiasi ruolo
 *                       registrato nel DB (blocca solo utenti senza profilo).
 * @returns AuthContext se l'accesso e autorizzato, NextResponse con errore altrimenti.
 *
 * @example
 *   const auth = await requireAuth(['admin', 'manager'])
 *   if (auth instanceof NextResponse) return auth
 *   const { userId, adminDb } = auth
 */
export async function requireAuth(
  allowedRoles: RuoloStudio[] | 'any' = 'any'
): Promise<AuthContext | NextResponse> {
  // 1. Verifica sessione JWT
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // 2. Legge il profilo dal DB (garantisce che l utente sia registrato nello studio)
  const adminDb = createAdminClient()
  const { data: profilo, error: profiloError } = await adminDb
    .from('profili')
    .select('ruolo, nome, cognome')
    .eq('id', user.id)
    .single()

  if (profiloError || !profilo) {
    return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })
  }

  // 3. Verifica ruolo (se specificato)
  if (allowedRoles !== 'any' && !(allowedRoles as string[]).includes(profilo.ruolo)) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
  }

  const nomeCompleto =
    [profilo.nome, profilo.cognome].filter(Boolean).join(' ').trim() ||
    user.email ||
    user.id

  return {
    userId: user.id,
    userEmail: user.email ?? '',
    profilo,
    nomeCompleto,
    adminDb,
  }
}

/** Ruoli con accesso amministrativo completo */
export const RUOLI_ADMIN = ['admin', 'manager'] as const

/** Ruoli con accesso operativo allo studio (lettura aree operative) */
export const RUOLI_STUDIO = ['admin', 'manager', 'staff', 'aso', 'segreteria', 'segretaria', 'clinico'] as const
