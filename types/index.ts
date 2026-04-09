export type UserRole = 'admin' | 'aso' | 'segretaria' | 'manager'

export interface UserProfile {
  id: string
  email: string
  nome: string
  cognome: string
  ruolo: UserRole
  telefono?: string | null
  avatar_url?: string | null
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
  fornitore_id?: string | null
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
  magazzin_item?: MagazzinoItem
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

export type CanaleOrdine = 'whatsapp' | 'email' | 'eshop' | 'telefono'

export interface Fornitore {
  id: string
  nome: string
  telefono?: string | null
  email?: string | null
  canale_ordine: CanaleOrdine
  sito_eshop?: string | null
  note?: string
  created_at: string
}

export interface RegistroEntry {
  id: string
  user_id?: string
  user_nome: string
  azione: string
  dettaglio?: string
  categoria: string
  created_at: string
}

export interface OrdineRiga {
  id: string
  ordine_id: string
  magazzino_id?: string | null
  prodotto_nome: string
  quantita_ordinata: number
  unita?: string | null
}

export interface Ordine {
  id: string
  fornitore_id?: string | null
  fornitore_nome: string
  stato: 'inviato' | 'ricevuto' | 'parziale' | 'annullato'
  canale: CanaleOrdine
  note?: string | null
  data_invio: string
  data_ricezione?: string | null
  created_by:?: string | null
  created_at: string
  righe?: OrdineRiga[]
}

export interface KPI {
  id: number
  pazienti_oggi: number
  pazienti_settimana: number
  paziUnti_mese: number
  appuntamenti_oggi: number
  fatturato_mese: number
  tasso_presenze: number
  updated_at: string
}
