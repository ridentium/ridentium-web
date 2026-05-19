-- ============================================================
-- Migration: Magazzino Intelligente v2
-- Data: 2026-05-19
-- Contenuto:
--   1. Tabella magazzino_movimenti (storico delta quantità)
--   2. Settings operativi: scadenze e copertura
-- ============================================================

-- ── 1. Tabella magazzino_movimenti ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.magazzino_movimenti (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  magazzino_id    UUID        NOT NULL REFERENCES public.magazzino(id) ON DELETE CASCADE,
  tipo            TEXT        NOT NULL
    CONSTRAINT magazzino_movimenti_tipo_check
    CHECK (tipo IN ('carico_manuale','scarico_manuale','ricezione_ordine','rettifica','rollback')),
  quantita_delta  NUMERIC     NOT NULL,   -- negativo = scarico, positivo = carico
  quantita_prima  NUMERIC,               -- quantità prima del movimento (per audit)
  quantita_dopo   NUMERIC     NOT NULL,   -- quantità dopo il movimento
  note            TEXT,
  created_by      UUID        REFERENCES public.profili(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.magazzino_movimenti ENABLE ROW LEVEL SECURITY;

-- Staff autenticato può leggere tutti i movimenti
CREATE POLICY "mag_movimenti_select_auth" ON public.magazzino_movimenti
  FOR SELECT TO authenticated USING (TRUE);

-- Le INSERT avvengono esclusivamente server-side via adminDb (bypass RLS)
-- Non serve una policy INSERT separata per utenti diretti

-- Indici: per query "ultimi N movimenti di un prodotto" e per aggregati consumo
CREATE INDEX IF NOT EXISTS idx_mag_mov_magazzino_at
  ON public.magazzino_movimenti(magazzino_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mag_mov_tipo_at
  ON public.magazzino_movimenti(tipo, created_at DESC);

-- ── 2. Settings operativi magazzino v2 ───────────────────────────────────────

INSERT INTO public.operational_settings (area, key, value) VALUES
  ('magazzino', 'giorni_scadenza_critica',    '30'),
  ('magazzino', 'giorni_scadenza_attenzione', '90'),
  ('magazzino', 'giorni_copertura_alert',     '14'),
  ('magazzino', 'giorni_consumo_medio',       '30')
ON CONFLICT (area, key) DO NOTHING;
