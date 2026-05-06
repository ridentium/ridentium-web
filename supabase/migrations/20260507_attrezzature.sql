-- =============================================================================
-- Migrazione: gestione attrezzature e registro manutenzioni
-- Ogni attrezzatura ha uno stato operativo e una scadenza manutenzione.
-- Il registro manutenzioni è append-only (ogni intervento è una riga).
-- =============================================================================

-- ── Tabella attrezzature ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attrezzature (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                       TEXT NOT NULL,
  categoria                  TEXT NOT NULL DEFAULT 'altro',
  numero_seriale             TEXT,
  fornitore_nome             TEXT,
  data_acquisto              DATE,
  frequenza_manutenzione     TEXT NOT NULL DEFAULT 'annuale',
  data_ultima_manutenzione   DATE,
  data_prossima_manutenzione DATE,
  stato                      TEXT NOT NULL DEFAULT 'operativo',
  note                       TEXT,
  created_by                 UUID REFERENCES public.profili(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabella manutenzioni ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manutenzioni (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attrezzatura_id  UUID NOT NULL REFERENCES public.attrezzature(id) ON DELETE CASCADE,
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo             TEXT NOT NULL DEFAULT 'ordinaria',
  eseguito_da      TEXT,
  note             TEXT,
  prossima_data    DATE,
  creato_da_nome   TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indici ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_manutenzioni_attrezzatura
  ON public.manutenzioni (attrezzatura_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attrezzature_stato
  ON public.attrezzature (stato);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.attrezzature ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutenzioni ENABLE ROW LEVEL SECURITY;

-- Tutti gli autenticati possono leggere (staff vede le attrezzature)
DROP POLICY IF EXISTS "authenticated_read" ON public.attrezzature;
CREATE POLICY "authenticated_read" ON public.attrezzature
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_read" ON public.manutenzioni;
CREATE POLICY "authenticated_read" ON public.manutenzioni
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admin può scrivere (service_role bypassa RLS)
DROP POLICY IF EXISTS "admin_write" ON public.attrezzature;
CREATE POLICY "admin_write" ON public.attrezzature
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo = 'admin')
  );

DROP POLICY IF EXISTS "admin_write" ON public.manutenzioni;
CREATE POLICY "admin_write" ON public.manutenzioni
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo = 'admin')
  );
