-- ── Ordini: traccia chi ha ricevuto la merce ─────────────────────────────────
-- Aggiunge la colonna received_by alla tabella ordini (nullable, additive).
-- Aggiorna la RPC ricevi_ordine_tx con parametro p_received_by opzionale.
-- Nessuna modifica distruttiva: ordini esistenti avranno received_by = NULL.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nuova colonna
ALTER TABLE public.ordini
  ADD COLUMN IF NOT EXISTS received_by TEXT;

COMMENT ON COLUMN public.ordini.received_by IS 'Nome di chi ha confermato la ricezione dell''ordine';

-- 2. Aggiornamento RPC (CREATE OR REPLACE — non distruttivo)
CREATE OR REPLACE FUNCTION public.ricevi_ordine_tx(
  p_ordine_id   UUID,
  p_righe       JSONB,
  p_note        TEXT    DEFAULT NULL,
  p_tipo        TEXT    DEFAULT 'totale',
  p_received_by TEXT    DEFAULT NULL
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

    -- incrementa il magazzino SOLO se c'è un magazzino_id e qty > 0
    IF v_magazzino_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE public.magazzino
         SET quantita       = COALESCE(quantita, 0) + v_qty,
             ultimo_riordino = NOW(),
             updated_at      = NOW()
       WHERE id = v_magazzino_id;
    END IF;
  END LOOP;

  UPDATE public.ordini
     SET stato          = v_nuovo_stato,
         note           = COALESCE(p_note, note),
         data_ricezione = NOW(),
         received_by    = p_received_by
   WHERE id = p_ordine_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'stato',         v_nuovo_stato,
    'data_ricezione', NOW(),
    'received_by',   p_received_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ricevi_ordine_tx(UUID, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
