'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@/types'
import { logActivityServer } from '@/lib/registro-server'

// Verifica che il chiamante sia un admin autenticato
async function requireAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single()
  return profilo?.ruolo === 'admin'
}

// Restituisce l'utente admin corrente con nome (o null se non autorizzato)
async function getAdminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili')
    .select('ruolo, nome, cognome')
    .eq('id', user.id)
    .single()
  if (!profilo || profilo.ruolo !== 'admin') return null
  return { id: user.id, nome: `${profilo.nome} ${profilo.cognome}`.trim() }
}

export async function createStaffAccount(data: {
  email: string
  password: string
  nome: string
  cognome: string
  ruolo: UserRole
  telefono?: string
}) {
  const adminUser = await getAdminUser()
  if (!adminUser) return { error: 'Accesso non autorizzato' }

  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { nome: data.nome, cognome: data.cognome },
  })

  if (authError) return { error: authError.message }

  // Trigger auto-crea il profilo; aggiorniamo con i dati corretti
  const { error: profileError } = await admin.from('profili').upsert({
    id: authData.user.id,
    email: data.email,
    nome: data.nome,
    cognome: data.cognome,
    ruolo: data.ruolo,
    telefono: data.telefono || null,
    attivo: true,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  await logActivityServer(
    adminUser.id,
    adminUser.nome,
    'Nuovo staff creato',
    `"${data.nome} ${data.cognome}" — ruolo: ${data.ruolo}`,
    'sistema'
  )

  revalidatePath('/admin/staff')
  return { success: true }
}

export async function updateStaffRole(id: string, ruolo: UserRole) {
  if (!await requireAdmin()) return { error: 'Accesso non autorizzato' }

  const admin = createAdminClient()
  const { error } = await admin.from('profili').update({ ruolo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/staff')
  return { success: true }
}

export async function toggleStaffAttivo(id: string, attivo: boolean) {
  if (!await requireAdmin()) return { error: 'Accesso non autorizzato' }

  const admin = createAdminClient()
  const { error } = await admin.from('profili').update({ attivo: !attivo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/staff')
  return { success: true }
}

export async function deleteStaffAccount(userId: string) {
  if (!await requireAdmin()) return { error: 'Accesso non autorizzato' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/staff')
  return { success: true }
}
