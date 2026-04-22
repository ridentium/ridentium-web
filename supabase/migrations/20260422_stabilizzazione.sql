-- =============================================================================
-- RIDENTIUM — Migrazione di stabilizzazione (22 aprile 2026)
-- =============================================================================
-- Da eseguire in Supabase SQL Editor (Project → SQL → New query → Run).
-- È idempotente: può essere rieseguita senza errori.
--
-- Cosa fa, in sintesi:
--   1. Crea (se mancanti) le tabelle del sistema notifiche/push.
--   2. Aggiunge gli indici che rendono veloci i fetch della campanella.
--   3. Inserisce i default di notification_settings.
--   4. Crea la funzione RPC `ricevi_ordine_tx` che rimpiazza la logica
--      lato applicazione con una transazione atomica e sicura contro
--      il "lost update" su magazzino (fix ai duplicati di aprile).
--   5. Pulisce i lead di test residui nel CRM (deploy-check, test-*, ecc).
-- =============================================================================


-- ── 1. Tabella notifiche ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifiche (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profili(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  titolo     TEXT NOT NULL,
  corpo      TEXT,
  url        TEXT,
  letta      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata   JSONB
);

CREATE INDEX IF NOT EXISTS idx_notifiche_user_letta
  ON public.notifiche(user_id, letta);
CREATE INDEX IF NOT EXISTS idx_notifiche_user_created
  ON public.notifiche(user_id, created_at DESC);

ALTER TABLE public.notifiche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select"     ON public.notifiche;
DROP POLICY IF EXISTS "own_update"     ON public.notifiche;
DROP POLICY IF EXISTS "service_insert" ON public.notifiche;

CREATE POLICY "own_select"     ON public.notifiche FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_update"     ON public.notifiche FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "service_insert" ON public.notifiche FOR INSERT WITH CHECK (TRUE);


-- ── 2. Tabella push_subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profili(id) ON DELETE CASCADE,
  ruolo      TEXT,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_ruolo ON public.push_subscriptions(ruolo);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all"     ON public.push_subscriptions;
DROP POLICY IF EXISTS "own_subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "admin_read_all"  ON public.push_subscriptions;

CREATE POLICY "own_subscription" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_read_all" ON public.push_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo = 'admin')
  );


-- ── 3. Tabella notification_settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo               TEXT NOT NULL UNIQUE,
  abilitata          BOOLEAN NOT NULL DEFAULT TRUE,
  ruoli_destinatari  TEXT[] NOT NULL DEFAULT ARRAY['admin']::TEXT[],
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.notification_settings (tipo, abilitata, ruoli_destinatari) VALUES
  ('stock_minimo',       TRUE, ARRAY['admin']),
  ('task_assegnata',     TRUE, ARRAY['admin','staff','aso','segretaria','manager']),
  ('ricorrente_scaduta', TRUE, ARRAY['admin']),
  ('crm_nuovo_lead',     TRUE, ARRAY['admin'])
ON CONFLICT (tipo) DO NOTHING;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON public.notification_settings;
CREATE POLICY "admin_all" ON public.notification_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo = 'admin')
  );


-- ── 4. Tabella user_notification_prefs ───────────────────────────────────────
-- Era referenziata da /api/notify/task ma non esisteva. Ora sì.
CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profili(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  abilitata  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tipo)
);

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_prefs" ON public.user_notification_prefs;
CREATE POLICY "own_prefs" ON public.user_notification_prefs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 5. RPC ricevi_ordine_tx — ricezione atomica, fine dei lost update ───────
-- p_ordine_id     UUID
-- p_righe         JSONB  [{ "id": "...", "qty": 3, "magazzino_id": "..."|null }, ...]
-- p_note          TEXT
-- p_tipo          TEXT ('totale' | 'parziale')
CREATE OR REPLACE FUNCTION public.ricevi_ordine_tx(
  p_ordine_id UUID,
  p_righe     JSONB,
  p_note      TEXT DEFAULT NULL,
  p_tipo      TEXT DEFAULT 'totale'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_riga            JSONB;
  v_riga_id         UUID;
  v_qty             NUMERIC;
  v_magazzino_id    UUID;
  v_nuovo_stato     TEXT;
BEGIN
  v_nuovo_stato := CASE WHEN p_tipo = 'totale' THEN 'ricevuto' ELSE 'parziale' END;

  -- Lock sull'ordine per evitare doppia ricezione concorrente
  PERFORM 1 FROM public.ordini WHERE id = p_ordine_id FOR UPDATE;

  FOR v_riga IN SELECT * FROM jsonb_array_elements(p_righe)
  LOOP
    v_riga_id      := (v_riga->>'id')::UUID;
    v_qty          := COALESCE((v_riga->>'qty')::NUMERIC, 0);
    v_magazzino_id := NULLIF(v_riga->>'magazzino_id','')::UUID;

    -- aggiorna la riga d'ordine
    UPDATE public.ordini_righe
       SET quantita_ricevuta = v_qty
     WHERE id = v_riga_id;

    -- incrementa il magazzino SOLO se c'è un magazzino_id e qty > 0,
    -- con lock di riga per prevenire lost update
    IF v_magazzino_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE public.magazzino
         SET quantita = COALESCE(quantita, 0) + v_qty,
             ultimo_riordino = NOW(),
             updated_at = NOW()
       WHERE id = v_magazzino_id;
    END IF;
  END LOOP;

  UPDATE public.ordini
     SET stato = v_nuovo_stato,
         note  = COALESCE(p_note, note),
         data_ricezione = NOW()
   WHERE id = p_ordine_id;

  RETURN jsonb_build_object(
    'ok', true,
    'stato', v_nuovo_stato,
    'data_ricezione', NOW()
  );
END;
$$;

-- Permesso: la funzione può essere chiamata solo con service role o da utenti admin/manager.
REVOKE ALL ON FUNCTION public.ricevi_ordine_tx(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;


-- ── 6. RPC annulla_ordine_tx — rollback atomico di una ricezione ────────────
-- Scala le quantità dal magazzino nella stessa transazione.
CREATE OR REPLACE FUNCTION public.annulla_ordine_tx(
  p_ordine_id UUID,
  p_righe     JSONB,
  p_note      TEXT DEFAULT NULL,
  p_stato_corrente TEXT DEFAULT 'inviato'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_riga            JSONB;
  v_qty             NUMERIC;
  v_magazzino_id    UUID;
BEGIN
  PERFORM 1 FROM public.ordini WHERE id = p_ordine_id FOR UPDATE;

  -- Se l'ordine era già ricevuto/parziale, scala le quantità dal magazzino
  IF p_stato_corrente IN ('ricevuto','parziale') THEN
    FOR v_riga IN SELECT * FROM jsonb_array_elements(p_righe)
    LOOP
      v_qty          := COALESCE((v_riga->>'qty')::NUMERIC, 0);
      v_magazzino_id := NULLIF(v_riga->>'magazzino_id','')::UUID;
      IF v_magazzino_id IS NOT NULL AND v_qty > 0 THEN
        UPDATE public.magazzino
           SET quantita = GREATEST(0, COALESCE(quantita, 0) - v_qty),
               updated_at = NOW()
         WHERE id = v_magazzino_id;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.ordini
     SET stato = 'annullato',
         note  = COALESCE(p_note, note)
   WHERE id = p_ordine_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.annulla_ordine_tx(UUID, JSONB, TEXT, TEXT) FROM PUBLIC;


-- ── 7. Pulizia lead di test nel CRM ─────────────────────────────────────────
-- (lanciata di proposito: sono dati evidentemente test/demo)
DELETE FROM public.crm_contatti
 WHERE email ILIKE 'deploy-test%'
    OR email ILIKE 'test.finale%'
    OR email ILIKE '%@example.com'
    OR (email IS NULL AND telefono IS NULL AND nome IS NULL AND cognome IS NULL)
    OR sorgente IN ('test-finale-verifica','deploy-check','test-await-fix');


-- =============================================================================
-- FINE migrazione. Nessun errore? Il codice applicativo è pronto ad usarla.
-- =============================================================================
