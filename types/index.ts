export type UserRole = 'admin' | 'aso' | 'segretaria' | 'manager' | 'clinico'

export interface UserProfile {
  id: string
  email: string
  nome: string
  cognome: string
  ruolo: UserRole
  avatar_url?: string
  attivo?: boolean
  telefono?: string | null
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
  deleted_at?: string | null
  created_at: string
  updated_at?: string
}

export interface SOP {
  id: string
  titolo: string
  categoria: string
  contenuto: string
  versione: string
  autore?: string
  ruoli_visibili?: UserRole[]
  created_at?: string
  updated_at?: string
  autore_profilo?: { nome: string | null; cognome: string | null }
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
  frequenza: 'giornaliero' | 'settimanale' | 'mensile' | 'trimestrale' | 'semestrale' | 'annuale' | 'biennale' | 'triennale' | 'quinquennale'
  assegnato_a?: string | null
  attiva: boolean
  deleted_at?: string | null
  completamenti: Completamento[]
  created_at: string
}
// ── Registro attività ──────────────────────────────────────────────────────────

export type CategoriaRegistro =
  | 'todo' | 'magazzino' | 'ordini' | 'fornitori' | 'staff'
  | 'ricorrenti' | 'crm' | 'sistema' | 'tasks' | 'adempimenti' | 'altro'

export interface RegistroEntry {
  id: string
  user_id: string
  user_nome: string
  azione: string
  dettaglio?: string | null
  categoria: CategoriaRegistro
  created_at: string
}

// ── Commenti task ──────────────────────────────────────────────────────────────

export interface TaskCommento {
  id: string
  task_id: string
  utente_id: string
  utente_nome: string
  testo: string
  created_at: string
}

// ── KPI clinici ───────────────────────────────────────────────────────────────

export interface KPI {
  id: number
  pazienti_oggi: number
  pazienti_settimana: number
  pazienti_mese: number
  appuntamenti_oggi: number
  fatturato_mese: number
  tasso_presenze: number
  updated_at?: string
}

// ── Ordini ────────────────────────────────────────────────────────────────────

export type StatoOrdine =
  | 'inviato'
  | 'confermato_fornitore'
  | 'in_consegna'
  | 'ricevuto'
  | 'parziale'
  | 'annullato'

export interface OrdineRiga {
  id: string
  ordine_id: string
  magazzino_id?: string | null
  prodotto_nome: string
  quantita_ordinata: number
  unita?: string | null
  quantita_ricevuta?: number | null
  created_at?: string
}

export interface Ordine {
  id: string
  fornitore_id?: string | null
  fornitore_nome: string
  canale?: CanaleOrdine | null
  stato: StatoOrdine
  note?: string | null
  data_invio: string
  data_ricezione?: string | null
  created_by?: string
  created_at: string
  righe?: OrdineRiga[]
}

// ── CRM ───────────────────────────────────────────────────────────────────────

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
