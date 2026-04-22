-- =============================================================================
-- RIDENTIUM — Impostazioni studio
-- =============================================================================
-- Tabella chiave-valore per le configurazioni dello studio (giorni di apertura,
-- orari, ecc.). Idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.impostazioni_studio (
  chiave      TEXT PRIMARY KEY,
  valore      JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.impostazioni_studio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impostazioni_read_team"   ON public.impostazioni_studio;
DROP POLICY IF EXISTS "impostazioni_write_admin" ON public.impostazioni_studio;

CREATE POLICY "impostazioni_read_team" ON public.impostazioni_studio
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "impostazioni_write_admin" ON public.impostazioni_studio
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo IN ('admin','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo IN ('admin','manager'))
  );

-- Seed valori default (Lun-Ven aperto, orario 8:30-19:30)
INSERT INTO public.impostazioni_studio (chiave, valore) VALUES
  ('giorni_apertura', '[1,2,3,4,5]'),
  ('orario_apertura', '"08:30"'),
  ('orario_chiusura', '"19:30"')
ON CONFLICT (chiave) DO NOTHING;
