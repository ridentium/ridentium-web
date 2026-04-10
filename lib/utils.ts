import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function roleLabel(ruolo: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: 'Amministratore',
    aso: 'ASO',
    segretaria: 'Segreteria',
    manager: 'Manager',
    clinico: 'Clinico',
  }
  return map[ruolo] ?? ruolo
}

export function roleColor(ruolo: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: 'text-gold',
    aso: 'text-blue-400',
    segretaria: 'text-purple-400',
    manager: 'text-green-400',
    clinico: 'text-amber-400',
  }
  return map[ruolo] ?? 'text-stone'
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
