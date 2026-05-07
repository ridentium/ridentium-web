-- =============================================================================
-- Migrazione: preferenze utente persistenti in DB
-- Una riga per utente con JSONB; merge per-chiave via operatore ||
-- garantisce update non distruttivo anche da più device simultanei.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_prefs (
  user_id    UUID PRIMARY KEY REFERENCES public.profili(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_prefs" ON public.user_prefs;
CREATE POLICY "own_prefs" ON public.user_prefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
