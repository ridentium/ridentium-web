-- ── Nota su completamento ricorrente ─────────────────────────────────────────
-- Estende toggle_completamento_ricorrente con p_nota TEXT DEFAULT NULL.
-- Non è una migrazione distruttiva: CREATE OR REPLACE non tocca dati esistenti.
-- I completamenti già registrati rimangono invariati; la nota è facoltativa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION toggle_completamento_ricorrente(
  p_ricorrente_id UUID,
  p_user_id       TEXT,
  p_user_name     TEXT,
  p_periodo_key   TEXT,
  p_nota          TEXT DEFAULT NULL
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
                              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'nota',       p_nota
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
