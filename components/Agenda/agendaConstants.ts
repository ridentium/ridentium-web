import type { ElementType } from 'react'
import type { AgendaTipo } from '@/types/agenda'
import { CheckSquare, RefreshCw, ShieldCheck } from 'lucide-react'

// ─── Local types ──────────────────────────────────────────────────────────────

export interface Profilo {
  id: string
  nome: string
  cognome: string
  ruolo: string
}

export type Tab = 'lista' | 'calendario' | 'focus' | 'aggiungi'
export type TipoNuovo = 'task' | 'ricorrente' | 'adempimento'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TIPO_CONFIG: Record<AgendaTipo, {
  label: string; icon: ElementType; color: string; bg: string; dot: string
}> = {
  task:        { label: 'Task',         icon: CheckSquare, color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20',    dot: '#60A5FA' },
  ricorrente:  { label: 'Ricorrente',   icon: RefreshCw,   color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: '#34D399' },
  adempimento: { label: 'Adempimento',  icon: ShieldCheck, color: 'text-gold',        bg: 'bg-gold/10 border-gold/20',            dot: '#C9A84C' },
}

export const RUOLO_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', aso: 'ASO', segretaria: 'Segreteria', clinico: 'Clinico',
}

export const PRIORITA_COLOR: Record<string, string> = {
  alta: 'text-red-400', media: 'text-amber-400', bassa: 'text-stone',
}

export const FREQ_LABEL: Record<string, string> = {
  giornaliero: 'Ogni giorno', settimanale: 'Ogni settimana', mensile: 'Ogni mese',
  trimestrale: 'Ogni trimestre', semestrale: 'Ogni semestre', annuale: 'Ogni anno',
  biennale: 'Ogni 2 anni', triennale: 'Ogni 3 anni', quinquennale: 'Ogni 5 anni',
}

export const STATO_LABEL: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completato: 'Completato',
}

export const STATO_COLOR: Record<string, string> = {
  da_fare:    'text-amber-400 border-amber-400/30 bg-amber-400/10',
  in_corso:   'text-blue-400 border-blue-400/30 bg-blue-400/10',
  completato: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
}

export const MESI_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export const GIORNI_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function formatData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function diffDays(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000)
}

export function scadenzaLabel(data: string | null): { text: string; color: string } {
  const days = diffDays(data)
  if (days === null) return { text: '', color: '' }
  if (days < 0)   return { text: `scaduto da ${Math.abs(days)}g`, color: 'text-red-400' }
  if (days === 0)  return { text: 'oggi', color: 'text-red-400' }
  if (days === 1)  return { text: 'domani', color: 'text-amber-400' }
  if (days <= 7)   return { text: `fra ${days} giorni`, color: 'text-amber-400' }
  if (days <= 30)  return { text: `fra ${days} giorni`, color: 'text-stone' }
  return { text: formatData(data), color: 'text-stone' }
}
