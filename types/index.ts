export type UserRole = 'admin' | 'aso' | 'segretaria' | 'manager'

export interface UserProfile {
  id: string
  email: string
  nome: string
  cognome: string
  ruolo: UserRole
  avatar_url?: string
  created_at: string
}

export interface MagazzinoItem {
  id: string
  prodotto: string
  categoria: string
  azienda: string
  codice_articolo?: string
  quantita: number
  soglia_minima: number
  unita: string
  diametro?: number
  lunghezza?: number
  prezzo_unitario?: number
  lotto?: string
  scadenza?: string
  ultimo_riordino?: string
  note?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  titolo: string
  descrizione?: string
  assegnato_a: string          // user id
  assegnato_a_profilo?: UserProfile
  creato_da: string
  stato: 'da_fare' | 'in_corso' | 'completato'
  priorita: 'bassa' | 'media' | 'alta'
  scadenza?: string
  created_at: string
  updated_at: string
}

export interface SOP {
  id: string
  titolo: string
  categoria: string
  contenuto: string            // markdown
  versione: string
  autore: string
  ruoli_visibili: UserRole[]   // chi può vedere questa SOP
  created_at: string
  updated_at: string
}

export interface RiordineRequest {
  id: string
  magazzino_item_id: string
  magazzino_item?: MagazzinoItem
  richiesto_da: string
  note?: string
  stato: 'aperta' | 'evasa' | 'annullata'
  created_at: string
}

export interface StatoScorta {
  item: MagazzinoItem
  alert: boolean
}

export interface RicorrenteCompletamento {
  userId: string
  userName: string
  periodoKey: string
  data: string
}

export interface Ricorrente {
  id: string
  titolo: string
  descrizione?: string
  frequenza: 'giornaliero' | 'settimanale' | 'mensile'
  assegnato_a?: string | null
  attiva: boolean
  completamenti: RicorrenteCompletamento[]
  created_at: string
}

export interface Fornitore {
  id: string
  nome: string
  telefono: string
  note?: string
  created_at: string
}

export interface RegistroEntry {
  id: string
  user_id?: string
  user_nome: string
  azione: string
  dettaglio?: string
  categoria: 'todo' | 'magazzino' | 'staff' | 'ricorrenti' | 'sistema' | 'altro'
  created_at: string
}

export interface KPI {
  id: number
  pazienti_oggi: number
  pazienti_settimana: number
  pazienti_mese: number
  appuntamenti_oggi: number
  fatturato_mese: number
  tasso_presenze: number
  updated_at: string
}
