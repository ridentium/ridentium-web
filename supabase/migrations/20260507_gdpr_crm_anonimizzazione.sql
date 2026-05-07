-- =============================================================================
-- Migrazione GDPR: anonimizzazione contatti CRM (art. 17 GDPR — diritto all'oblio)
-- =============================================================================
--
-- STRATEGIA ADOTTATA: anonimizzazione + soft-delete (NON cancellazione fisica)
--
-- Motivazione:
--   Il DELETE fisico distrugge la traccia dell'avvenuta cancellazione, rendendo
--   impossibile dimostrare in fase di audit che la richiesta di oblio e stata
--   evasa. La strategia scelta mantiene una riga "vuota" con:
--     - tutti i dati personali azzerati (nome, cognome, email, telefono, note,
--       sorgente)
--     - il flag anonimizzato = true
--     - il timestamp gdpr_deleted_at per prove di conformita
--     - dati non personali preservati (stato, consenso, created_at) solo per
--       statistiche aggregate e tracciabilita legale del consenso
--
-- Questa migrazione e NON DISTRUTTIVA: non modifica, non sposta e non elimina
-- nessun dato esistente. Aggiunge solo due colonne con valori di default.
--
-- Da applicare sul progetto Supabase prima del deploy del codice MC-1.5.
-- =============================================================================

-- ── 1. Colonne GDPR sulla tabella crm_contatti ────────────────────────────────

ALTER TABLE public.crm_contatti
  ADD COLUMN IF NOT EXISTS anonimizzato    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gdpr_deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.crm_contatti.anonimizzato IS
  'TRUE se il contatto e stato anonimizzato per richiesta GDPR (art. 17). '
  'I record con anonimizzato=TRUE non devono apparire nella vista operativa.';

COMMENT ON COLUMN public.crm_contatti.gdpr_deleted_at IS
  'Timestamp dell''operazione di anonimizzazione GDPR. '
  'Usato come prova di conformita in caso di ispezione.';

-- ── 2. Indice parziale per escludere anonimizzati in modo efficiente ──────────
-- Le query operative filtrino sempre su anonimizzato = false.
-- Questo indice copre solo i record attivi, riducendo la dimensione.

CREATE INDEX IF NOT EXISTS idx_crm_contatti_attivi
  ON public.crm_contatti (created_at DESC)
  WHERE anonimizzato = FALSE;

-- ── 3. Nessuna modifica ai record esistenti ───────────────────────────────────
-- Tutti i record esistenti avranno anonimizzato = FALSE (default) e
-- gdpr_deleted_at = NULL, che e il comportamento corretto per record attivi.
