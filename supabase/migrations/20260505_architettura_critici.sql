-- ============================================================
-- Migration: architettura critici
-- Data: 2026-05-05
-- Fix: ruolo clinico, RPC atomiche, indici performance
-- ============================================================

-- ── 1. Aggiungi ruolo 'clinico' al CHECK constraint ─────────────────────────
ALTER TABLE profili DROP CONSTRAINT IF EXISTS profili_ruolo_check;
ALTER TABLE profili ADD CONSTRAINT profili_ruolo_check
  CHECK (ruolo IN ('admin', 'aso', 'segretaria', 'manager', 'clinico'));

-- ── 2. RPC ripristina_ricezione_tx (atomica) ────────────────────────────────
-- Esegue rollback ricezione ordine in un'unica transazione:
-- scala le quantità ricevute dal magazzino e riporta l'ordine a 'inviato'.
-- Sostituisce il loop non-atomico in app/api/ordini/[id]/route.ts.
CREATE OR REPLACE FUNCTION ripristina_ricezione_tx(
  p_ordine_id   UUID,
  p_righe       JSONB,
  p_note        TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  riga          JSONB;
  v_magazzino   UUID;
  v_qty         NUMERIC;
BEGIN
  -- Per ogni riga: scala la quantità ricevuta dal magazzino
  FOR riga IN SELECT * FROM jsonb_array_elements(p_righe)
  LOOP
    v_magazzino := (riga->>'magazzino_id')::UUID;
    v_qty       := COALESCE((riga->>'qty')::NUMERIC, 0);

    IF v_magazzino IS NOT NULL AND v_qty > 0 THEN
      UPDATE magazzino
         SET quantita = GREATEST(0, quantita - v_qty)
       WHERE id = v_magazzino;
    END IF;
  END LOOP;

  -- Riporta l'ordine a 'inviato' e cancella la data_ricezione
  UPDATE ordini
     SET stato          = 'inviato',
         data_ricezione = NULL,
         note           = p_note
   WHERE id = p_ordine_id;
END;
$$;

-- ── 3. RPC toggle_completamento_ricorrente (atomica, FOR UPDATE) ─────────────
-- Aggiunge o rimuove un completamento nel JSONB ricorrenti.completamenti
-- usando SELECT FOR UPDATE per evitare la race condition "last write wins"
-- quando due utenti cliccano "Completa" contemporaneamente.
CREATE OR REPLACE FUNCTION toggle_completamento_ricorrente(
  p_ricorrente_id UUID,
  p_user_id       TEXT,
  p_user_name     TEXT,
  p_periodo_key   TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_completamenti     JSONB;
  v_new_completamenti JSONB := '[]'::JSONB;
  v_found             BOOL  := FALSE;
  v_len               INT;
  i                   INT;
BEGIN
  -- Acquisisce lock esclusivo sulla riga (serializza accessi concorrenti)
  SELECT completamenti
    INTO v_completamenti
    FROM ricorrenti
   WHERE id = p_ricorrente_id
     FOR UPDATE;

  v_completamenti := COALESCE(v_completamenti, '[]'::JSONB);
  v_len := jsonb_array_length(v_completamenti);

  -- Ricostruisce l'array saltando la voce dell'utente corrente (se esiste)
  FOR i IN 0..v_len - 1
  LOOP
    IF (v_completamenti->i->>'userId')    = p_user_id
   AND (v_completamenti->i->>'periodoKey') = p_periodo_key THEN
      v_found := TRUE;   -- trovato → lo escludiamo (toggle OFF)
    ELSE
      v_new_completamenti := v_new_completamenti
                          || jsonb_build_array(v_completamenti->i);
    END IF;
  END LOOP;

  -- Se non trovato → aggiunge nuova voce (toggle ON)
  IF NOT v_found THEN
    v_new_completamenti := v_new_completamenti || jsonb_build_array(
      jsonb_build_object(
        'userId',     p_user_id,
        'userName',   p_user_name,
        'periodoKey', p_periodo_key,
        'data',       to_char(now() AT TIME ZONE 'UTC',
                              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    );
  END IF;

  -- Scrive il risultato
  UPDATE ricorrenti
     SET completamenti = v_new_completamenti
   WHERE id = p_ricorrente_id;

  RETURN v_new_completamenti;
END;
$$;

-- ── 4. Indici performance ────────────────────────────────────────────────────
-- Ricerche frequenti su tasks (assegnato_a + stato, escludendo soft-deleted)
CREATE INDEX IF NOT EXISTS idx_tasks_assegnato_stato
  ON tasks(assegnato_a, stato)
  WHERE deleted_at IS NULL;

-- Filtro attiva=TRUE escludendo deleted su ricorrenti
CREATE INDEX IF NOT EXISTS idx_ricorrenti_attiva
  ON ricorrenti(attiva)
  WHERE deleted_at IS NULL AND attiva = TRUE;

-- Registro attività: ordinamento DESC per le query più recenti
CREATE INDEX IF NOT EXISTS idx_registro_created_at
  ON registro_attivita(created_at DESC);
