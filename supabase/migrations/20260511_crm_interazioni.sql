-- Sprint 1 CRM Vivente: tabella storico interazioni per contatti CRM
-- Ogni riga = un'azione sulla relazione (chiamata, email, nota, etc.)
-- prossima_azione + prossima_data abilitano i filtri follow-up.
-- ON DELETE CASCADE: se il contatto viene GDPR-anonimizzato, le interazioni
-- restano (non contengono PII dirette) ma se il record viene fisicamente rimosso
-- le righe figlie spariscono in automatico.

CREATE TABLE IF NOT EXISTS crm_interazioni (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  crm_contatto_id   uuid        NOT NULL REFERENCES crm_contatti(id) ON DELETE CASCADE,
  tipo              text        NOT NULL CHECK (tipo IN ('chiamata','email','whatsapp','nota','appuntamento')),
  contenuto         text        NOT NULL CHECK (char_length(contenuto) BETWEEN 1 AND 2000),
  prossima_azione   text        CHECK (char_length(prossima_azione) <= 500),
  prossima_data     date,
  creato_da         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  creato_da_nome    text        CHECK (char_length(creato_da_nome) <= 255),
  created_at        timestamptz DEFAULT now() NOT NULL
);

-- Indice per fetch rapida delle interazioni di un contatto (endpoint GET)
CREATE INDEX IF NOT EXISTS idx_crm_interazioni_contatto_id
  ON crm_interazioni(crm_contatto_id, created_at DESC);

-- Indice per i filtri follow-up (da richiamare oggi / settimana / scaduti)
CREATE INDEX IF NOT EXISTS idx_crm_interazioni_prossima_data
  ON crm_interazioni(prossima_data)
  WHERE prossima_data IS NOT NULL;

-- RLS: abilitata ma gestita via adminClient lato API (bypassa RLS)
-- Le rotte API usano createAdminClient() — coerente con il pattern del progetto.
ALTER TABLE crm_interazioni ENABLE ROW LEVEL SECURITY;
