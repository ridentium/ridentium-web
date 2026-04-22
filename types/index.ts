export type UserRole = 'admin' | 'aso' | 'segretaria' | 'manager' | 'clinico'

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
  azienda?: string | null
  codice_articolo?: string | null
  quantita: number
  soglia_minima: number
  unita: string
  diametro?: number | null
  lunghezza?: number | null
  prezzo_unitario?: number | null
  lotto?: string | null
  scadenza?: string | null
  ultimo_riordino?: string | null
  note?: string | null
  fornitore_id?: string | null
  created_at: string
  updated_at?: string
}

export interface Task {
  id: string
  titolo: string
  descrizione?: string
  assegnato_a: string
  assegnato_a_profilo?: UserProfile
  creato_da: string
  stato: 'da_fare' | 'in_corso' | 'completato'
  priorita: 'bassa' | 'media' | 'alta'
  scadenza?: string
  created_at: string
  updated_at?: string
}

export interface SOP {
  id: string
  titolo: string
  categoria: string
  contenuto: string
  versione: string
  autore: string
  ruoli_visibili: UserRole[]
  created_at: string
  updated_at?: string
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

export type CanaleOrdine = 'whatsapp' | 'email' | 'eshop' | 'telefono'

export interface FornitoreContatto {
  id: string
  fornitore_id: string
  nome: string
  ruolo?: string | null
  telefono?: string | null
  whatsapp?: string | null
  email?: string | null
  metodo_predefinito: CanaleOrdine
  is_predefinito: boolean
  created_at: string
}

export interface Fornitore {
  id: string
  nome: string
  telefono?: string | null
  email?: string | null
  sito_eshop?: string | null
  canale_ordine?: CanaleOrdine | null
  note?: string | null
  created_at: string
  fornitore_contatti?: FornitoreContatto[]
}

export interface Completamento {
  userId: string
  userName: string
  periodoKey: string
  data: string
  nota?: string
}

export interface Ricorrente {
  id: string
  titolo: string
  descrizione?: string | null
  frequenza: 'giornaliero' | 'settimanale' | 'mensile'
  assegnato_a?: string | null
  attiva: boolean
  completamenti: Completamento[]
  created_at: string
}
export type CRMStato = 'nuovo' | 'contattato' | 'appuntamento' | 'cliente' | 'perso'

export interface CRMContatto {
  id: string
  nome: string | null
  cognome: string | null
  email: string | null
  telefono: string | null
  stato: CRMStato
  sorgente: string | null
  note: string | null
  consenso_privacy: boolean
  consenso_marketing: boolean
  consenso_versione: string | null
  consenso_timestamp: string | null
  created_at: string
  updated_at: string
}
