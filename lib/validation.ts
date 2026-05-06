/**
 * Schema di validazione Zod centralizzati (Zod v4).
 * Usati dalle API route per validare il body prima di toccare il DB.
 * Pattern: schema.safeParse(body) → se !success → 400 con dettagli.
 */
import { z } from 'zod'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Stringa non-vuota dopo trim (Zod v4) */
const nonEmptyString = (maxLen = 255) =>
  z.string().trim().min(1).max(maxLen)

/** UUID valido */
const uuid = z.string().uuid()

/** Funzione helper: restituisce un messaggio di errore leggibile dai Zod issues */
export function zodError(result: { error: z.ZodError }) {
  const messages = result.error.issues
    .map((e: z.ZodIssue) => `${e.path.length ? e.path.join('.') + ': ' : ''}${e.message}`)
    .join('; ')
  return { error: `Dati non validi: ${messages}` }
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  titolo:      nonEmptyString(255),
  descrizione: z.string().trim().max(2000).optional().nullable(),
  assegnato_a: uuid.optional().nullable(),
  priorita:    z.enum(['bassa', 'media', 'alta']).default('media'),
  scadenza:    z.string().optional().nullable(),
})

export const updateTaskSchema = z.object({
  titolo:      z.string().trim().min(1).max(255).optional(),
  descrizione: z.string().trim().max(2000).optional().nullable(),
  stato:       z.enum(['da_fare', 'in_corso', 'completato']).optional(),
  priorita:    z.enum(['bassa', 'media', 'alta']).optional(),
  scadenza:    z.string().optional().nullable(),
  assegnato_a: uuid.optional().nullable(),
})

// ── Ricorrenti ───────────────────────────────────────────────────────────────

const FREQUENZE = [
  'giornaliero', 'settimanale', 'mensile',
  'trimestrale', 'semestrale', 'annuale',
  'biennale', 'triennale', 'quinquennale',
] as const

export const createRicorrenteSchema = z.object({
  titolo:      nonEmptyString(255),
  descrizione: z.string().trim().max(1000).optional().nullable(),
  frequenza:   z.enum(FREQUENZE),
  assegnato_a: uuid.optional().nullable(),
})

export const updateRicorrenteSchema = z.object({
  titolo:      z.string().trim().min(1).max(255).optional(),
  descrizione: z.string().trim().max(1000).optional().nullable(),
  frequenza:   z.enum(FREQUENZE).optional(),
  assegnato_a: uuid.optional().nullable(),
  attiva:      z.boolean().optional(),
})

// ── Ordini ───────────────────────────────────────────────────────────────────

const ordineRigaSchema = z.object({
  magazzino_id:      uuid.optional().nullable(),
  prodotto_nome:     nonEmptyString(255),
  quantita_ordinata: z.number().int().positive(),
  unita:             z.string().trim().max(20).optional().nullable(),
})

export const createOrdineSchema = z.object({
  fornitore_id:   uuid.optional().nullable(),
  fornitore_nome: nonEmptyString(255),
  canale:         z.enum(['whatsapp', 'email', 'eshop', 'telefono']).default('whatsapp'),
  note:           z.string().trim().max(1000).optional().nullable(),
  righe:          z.array(ordineRigaSchema).min(1),
})

// ── Adempimenti ──────────────────────────────────────────────────────────────

export const createAdempimentoSchema = z.object({
  titolo:        nonEmptyString(255),
  descrizione:   z.string().trim().max(2000).optional().nullable(),
  categoria:     z.string().trim().min(1).max(50),
  frequenza:     z.string().trim().min(1).max(50),
  scadenza:      z.string().optional().nullable(),
  responsabile:  z.string().trim().max(255).optional().nullable(),
  consulente_id: uuid.optional().nullable(),
})

// ── KPI ──────────────────────────────────────────────────────────────────────

export const upsertKpiSchema = z.object({
  pazienti_oggi:       z.number().int().min(0),
  pazienti_settimana:  z.number().int().min(0),
  pazienti_mese:       z.number().int().min(0),
  appuntamenti_oggi:   z.number().int().min(0),
  fatturato_mese:      z.number().min(0),
  tasso_presenze:      z.number().min(0).max(100),
})

// ── SOP ──────────────────────────────────────────────────────────────────────

export const createSopSchema = z.object({
  titolo:          nonEmptyString(255),
  categoria:       nonEmptyString(100),
  contenuto:       z.string().trim().max(20000).optional().nullable(),
  versione:        z.string().trim().max(20).optional(),
  ruoli_visibili:  z.array(z.string()).optional(),
})

export const updateSopSchema = z.object({
  titolo:          z.string().trim().min(1).max(255).optional(),
  categoria:       z.string().trim().min(1).max(100).optional(),
  contenuto:       z.string().trim().max(20000).optional().nullable(),
  versione:        z.string().trim().max(20).optional(),
  ruoli_visibili:  z.array(z.string()).optional(),
})

// ── Fornitori ────────────────────────────────────────────────────────────────

export const createFornitoreSchema = z.object({
  nome: nonEmptyString(255),
  note: z.string().trim().max(500).optional().nullable(),
})

export const updateFornitoreSchema = z.object({
  nome: z.string().trim().min(1).max(255).optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

const CANALI_ORDINE = ['whatsapp', 'email', 'eshop', 'telefono'] as const

export const createContattoSchema = z.object({
  nome:                nonEmptyString(255),
  ruolo:               z.string().trim().max(100).optional().nullable(),
  telefono:            z.string().trim().max(50).optional().nullable(),
  whatsapp:            z.string().trim().max(50).optional().nullable(),
  email:               z.string().trim().max(255).optional().nullable(),
  metodo_predefinito:  z.enum(CANALI_ORDINE).default('whatsapp'),
  is_predefinito:      z.boolean().default(false),
})

export const updateContattoSchema = z.object({
  nome:                z.string().trim().min(1).max(255).optional(),
  ruolo:               z.string().trim().max(100).optional().nullable(),
  telefono:            z.string().trim().max(50).optional().nullable(),
  whatsapp:            z.string().trim().max(50).optional().nullable(),
  email:               z.string().trim().max(255).optional().nullable(),
  metodo_predefinito:  z.enum(CANALI_ORDINE).optional(),
  is_predefinito:      z.boolean().optional(),
})

// ── Magazzino ────────────────────────────────────────────────────────────────

export const createMagazzinoItemSchema = z.object({
  prodotto:        nonEmptyString(255),
  categoria:       z.string().trim().min(1).max(100),
  azienda:         z.string().trim().max(100).optional().nullable(),
  codice_articolo: z.string().trim().max(100).optional().nullable(),
  quantita:        z.number().int().min(0).default(0),
  soglia_minima:   z.number().int().min(0).default(0),
  unita:           z.string().trim().max(20).default('pz'),
  diametro:        z.number().optional().nullable(),
  lunghezza:       z.number().optional().nullable(),
  prezzo_unitario: z.number().optional().nullable(),
  scadenza:        z.string().optional().nullable(),
  note:            z.string().trim().max(500).optional().nullable(),
  fornitore_id:    uuid.optional().nullable(),
})

export const updateMagazzinoItemSchema = z.object({
  prodotto:        z.string().trim().min(1).max(255).optional(),
  categoria:       z.string().trim().min(1).max(100).optional(),
  azienda:         z.string().trim().max(100).optional().nullable(),
  codice_articolo: z.string().trim().max(100).optional().nullable(),
  quantita:        z.number().int().min(0).optional(),
  soglia_minima:   z.number().int().min(0).optional(),
  unita:           z.string().trim().max(20).optional(),
  diametro:        z.number().optional().nullable(),
  lunghezza:       z.number().optional().nullable(),
  prezzo_unitario: z.number().optional().nullable(),
  scadenza:        z.string().optional().nullable(),
  note:            z.string().trim().max(500).optional().nullable(),
  fornitore_id:    uuid.optional().nullable(),
})

export const createRiordineSchema = z.object({
  magazzino_id: uuid,
  note:         z.string().trim().max(500).optional().nullable(),
})

export const evadisciRiordineSchema = z.object({
  riordine_id:  uuid,
  magazzino_id: uuid,
  qty_ricevuta: z.number().int().positive(),
})

// ── Profilo ──────────────────────────────────────────────────────────────────

export const updateProfiloSchema = z.object({
  nome:     nonEmptyString(100),
  cognome:  nonEmptyString(100),
  telefono: z.string().trim().max(50).optional().nullable(),
})

export const upsertNotifPrefSchema = z.object({
  tipo:      nonEmptyString(100),
  abilitata: z.boolean(),
})

// ── Impostazioni notifiche (admin) ────────────────────────────────────────────

export const updateNotifSettingSchema = z.object({
  abilitata:          z.boolean().optional(),
  ruoli_destinatari:  z.array(z.string()).optional(),
})

// ── Permessi sezioni ──────────────────────────────────────────────────────────

export const upsertPermessoSchema = z.object({
  sezione:  z.enum(['magazzino', 'tasks', 'ricorrenti', 'sop']),
  ruolo:    z.enum(['aso', 'segretaria', 'manager', 'clinico']),
  visibile: z.boolean(),
})

// ── Adempimenti update ────────────────────────────────────────────────────────

export const updateAdempimentoSchema = z.object({
  titolo:                  z.string().trim().min(1).max(255).optional(),
  descrizione:             z.string().trim().max(2000).optional().nullable(),
  categoria:               z.string().trim().min(1).max(50).optional(),
  frequenza:               z.string().trim().min(1).max(50).optional(),
  responsabile_profilo_id: uuid.optional().nullable(),
  consulente_id:           uuid.optional().nullable(),
  responsabile_etichetta:  z.string().trim().max(255).optional().nullable(),
  evidenza_richiesta:      z.string().trim().max(500).optional().nullable(),
  riferimento_normativo:   z.string().trim().max(500).optional().nullable(),
  preavviso_giorni:        z.number().int().min(1).max(365).optional(),
  prossima_scadenza:       z.string().optional().nullable(),
  note:                    z.string().trim().max(1000).optional().nullable(),
  attivo:                  z.boolean().optional(),
})
