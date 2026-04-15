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
  scadenza?: string | null
  prezzo_unitario?: number | null
  note?: string | null
  fornitore_id?: string | null
  created_at: string
}

export type CanaleOrdine = 'whatsapp' | 'email' | 'eshop' | 'telefono'

export interface Fornitore {
  id: string
  nome: string
  telefono?: string | null
  email?: string | null
  sito_eshop?: string | null
  canale_ordine?: CanaleOrdine | null
  note?: string | null
  created_at: string
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
