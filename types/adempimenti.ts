export type FrequenzaAdempimento =
  | 'giornaliero'
  | 'settimanale'
  | 'mensile'
  | 'trimestrale'
  | 'semestrale'
  | 'annuale'
  | 'biennale'
  | 'triennale'
  | 'quinquennale'

export type CategoriaAdempimento =
  | 'apertura_chiusura'
  | 'sterilizzazione'
  | 'rifiuti'
  | 'radioprotezione'
  | 'manutenzione'
  | 'legionella'
  | 'sicurezza'
  | 'privacy'
  | 'fiscale'
  | 'sistema_ts'
  | 'albo_assicurazioni'
  | 'formazione'
  | 'audit'
  | 'clinico'
  | 'amministrativo'
  | 'altro'

export type StatoAdempimento = 'ok' | 'in_scadenza' | 'scaduto'

export interface Consulente {
  id: string
  ruolo: string
  nome: string
  email: string | null
  telefono: string | null
  note: string | null
  attivo: boolean
  created_at: string
}

export interface Adempimento {
  id: string
  titolo: string
  descrizione: string | null
  categoria: CategoriaAdempimento
  frequenza: FrequenzaAdempimento
  responsabile_profilo_id: string | null
  consulente_id: string | null
  responsabile_etichetta: string | null
  evidenza_richiesta: string | null
  riferimento_normativo: string | null
  preavviso_giorni: number
  prossima_scadenza: string | null
  ultima_esecuzione: string | null
  evidenza_descrizione: string | null
  evidenza_url: string | null
  attivo: boolean
  note: string | null
  created_at: string
  updated_at: string
  // Join opzionali
  responsabile_profilo?: { id: string; nome: string; cognome: string } | null
  consulente?: Consulente | null
}

export interface AdempimentoEsecuzione {
  id: string
  adempimento_id: string
  data_scadenza: string | null
  data_esecuzione: string
  eseguito_da_profilo_id: string | null
  eseguito_da_nome: string | null
  note: string | null
  evidenza_descrizione: string | null
  evidenza_url: string | null
  created_at: string
}

export const FREQUENZA_LABEL: Record<FrequenzaAdempimento, string> = {
  giornaliero:  'Giornaliero',
  settimanale:  'Settimanale',
  mensile:      'Mensile',
  trimestrale:  'Trimestrale',
  semestrale:   'Semestrale',
  annuale:      'Annuale',
  biennale:     'Biennale',
  triennale:    'Triennale',
  quinquennale: 'Ogni 5 anni',
}

export const CATEGORIA_LABEL: Record<CategoriaAdempimento, string> = {
  apertura_chiusura:  'Apertura/Chiusura',
  sterilizzazione:    'Sterilizzazione',
  rifiuti:            'Rifiuti sanitari',
  radioprotezione:    'Radioprotezione',
  manutenzione:       'Manutenzione',
  legionella:         'Legionella & Acque',
  sicurezza:          'Sicurezza sul lavoro',
  privacy:            'Privacy / GDPR',
  fiscale:            'Fiscale',
  sistema_ts:         'Sistema TS',
  albo_assicurazioni: 'Albo & Assicurazioni',
  formazione:         'Formazione / ECM',
  audit:              'Audit & Riunioni',
  clinico:            'Clinico',
  amministrativo:     'Amministrativo',
  altro:              'Altro',
}

export const CATEGORIA_COLOR: Record<CategoriaAdempimento, string> = {
  apertura_chiusura:  '#60A5FA',
  sterilizzazione:    '#34D399',
  rifiuti:            '#A78BFA',
  radioprotezione:    '#F87171',
  manutenzione:       '#FBBF24',
  legionella:         '#22D3EE',
  sicurezza:          '#F97316',
  privacy:            '#818CF8',
  fiscale:            '#C9A84C',
  sistema_ts:         '#D2C6B6',
  albo_assicurazioni: '#FB7185',
  formazione:         '#4ADE80',
  audit:              '#E879F9',
  clinico:            '#F472B6',
  amministrativo:     '#94A3B8',
  altro:              '#A0907E',
}

/**
 * Dato un adempimento attivo, calcola il suo stato corrente.
 */
export function calcolaStato(a: Adempimento, oggi = new Date()): StatoAdempimento {
  if (!a.prossima_scadenza) return 'ok'
  const scad = new Date(a.prossima_scadenza)
  const oggiMidnight = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())
  if (scad < oggiMidnight) return 'scaduto'
  const diffDays = Math.ceil((scad.getTime() - oggiMidnight.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= a.preavviso_giorni) return 'in_scadenza'
  return 'ok'
}

/**
 * Stringa leggibile "fra 3 giorni" / "scaduto da 2 giorni" / "oggi" / "2 mesi".
 */
export function scadenzaLabel(a: Adempimento, oggi = new Date()): string {
  if (!a.prossima_scadenza) return '—'
  const scad = new Date(a.prossima_scadenza)
  const oggiMidnight = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())
  const diffDays = Math.ceil((scad.getTime() - oggiMidnight.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'oggi'
  if (diffDays === 1) return 'domani'
  if (diffDays === -1) return 'scaduta ieri'
  if (diffDays < 0) return `scaduta da ${Math.abs(diffDays)} giorni`
  if (diffDays < 14) return `fra ${diffDays} giorni`
  if (diffDays < 60) return `fra ${Math.round(diffDays / 7)} settimane`
  if (diffDays < 365) return `fra ${Math.round(diffDays / 30)} mesi`
  return `fra ${Math.round(diffDays / 365)} anni`
}
