/**
 * Agenda unificata — fonde Task, Ricorrenti e Adempimenti in un'unica vista.
 */

export type AgendaTipo = 'task' | 'ricorrente' | 'adempimento'

export interface AgendaEvent {
  id: string
  tipo: AgendaTipo
  titolo: string
  descrizione?: string | null
  data: string | null          // ISO date YYYY-MM-DD
  /** solo per task */
  stato?: 'da_fare' | 'in_corso' | 'completato' | null
  /** solo per task */
  priorita?: 'bassa' | 'media' | 'alta' | null
  /** solo per adempimenti */
  categoria?: string | null
  /** solo per ricorrenti */
  frequenza?: string | null
  /** profilo assegnatario (null = nessuno / tutti) */
  assegnato_a_id?: string | null
  assegnato_a_nome?: string | null
  /** link diretto per aprire il record */
  href: string
}
