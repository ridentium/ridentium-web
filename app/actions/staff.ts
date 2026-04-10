'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@/types'

export async function createStaffAccount(data: {
  email: string
  password: string
  nome: string
  cognome: string
  ruolo: UserRole
  telefono?: string
}) {
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

  revalidatePath('/admin/staff')
  return { success: true }
}

export async function updateStaffRole(id: string, ruolo: UserRole) {
  const admin = createAdminClient()
  const { error } = await admin.from('profili').update({ ruolo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/staff')
  return { success: true }
}

export async function toggleStaffAttivo(id: string, attivo: boolean) {
  const admin = createAdminClient()
  const { error } = await admin.from('profili').update({ attivo: !attivo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/staff')
  return { success: true }
}

export async function deleteStaffAccount(userId: string) {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  revalidatePath('/admin/staff')
  return { success: true }
}
