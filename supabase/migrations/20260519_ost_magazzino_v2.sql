-- ============================================================
-- OST Magazzino v2 — Operational Smoke Test
-- Eseguire via Supabase Dashboard → SQL Editor
-- Usare sezione per sezione: SETUP → VERIFICA → CLEANUP
--
-- Tutti i prodotti TEST_AI hanno prefisso "TEST_AI_" e possono
-- essere rimossi in blocco con il blocco CLEANUP finale.
-- NON eseguire in produzione senza aver completato il CLEANUP.
-- ============================================================

-- ============================================================
-- BLOCCO 1: SETUP — Inserimento prodotti di test
-- ============================================================

-- TEST_AI_001: prodotto normale, scorta OK
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato
) VALUES (
  'aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa',
  'TEST_AI_001 Impianto Base',
  'Impianti', 10, 5, 'pz', 'normale', false
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_002: sotto soglia, priorità critica (deve apparire in Ordine Rapido)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato
) VALUES (
  'aaaaaaaa-aa02-aa02-aa02-aaaaaaaaaaaa',
  'TEST_AI_002 Vite Cricica',
  'Componentistica Protesica', 1, 5, 'pz', 'critica', false
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_003: sotto soglia, alert SILENZIATO (non deve apparire in alert)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  alert_silenziato_motivo
) VALUES (
  'aaaaaaaa-aa03-aa03-aa03-aaaaaaaaaaaa',
  'TEST_AI_003 Provvisorio',
  'Materiali Chirurgici', 2, 10, 'pz', 'bassa', true,
  'In esaurimento programmata — verifica a fine mese'
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_004: scadenza SCADUTA ieri (deve apparire in badge rosso Scaduto)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  scadenza
) VALUES (
  'aaaaaaaa-aa04-aa04-aa04-aaaaaaaaaaaa',
  'TEST_AI_004 Membrana Scaduta',
  'Materiali Chirurgici', 8, 2, 'pz', 'alta', false,
  (current_date - interval '1 day')::date::text
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_005: scadenza entro 30 giorni (badge critica)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  scadenza
) VALUES (
  'aaaaaaaa-aa05-aa05-aa05-aaaaaaaaaaaa',
  'TEST_AI_005 Anestetici Critica',
  'Consumabili', 15, 5, 'pz', 'alta', false,
  (current_date + interval '15 days')::date::text
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_006: scadenza entro 90 giorni (badge attenzione)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  scadenza
) VALUES (
  'aaaaaaaa-aa06-aa06-aa06-aaaaaaaaaaaa',
  'TEST_AI_006 Filo Sutura Attenzione',
  'Materiali Chirurgici', 20, 5, 'pz', 'normale', false,
  (current_date + interval '60 days')::date::text
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_007: silenziato + scadenza critica (badge scadenza DEVE essere visibile)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  scadenza, alert_silenziato_motivo
) VALUES (
  'aaaaaaaa-aa07-aa07-aa07-aaaaaaaaaaaa',
  'TEST_AI_007 Silenziato+Scadenza',
  'Consumabili', 3, 10, 'pz', 'normale', true,
  (current_date + interval '10 days')::date::text,
  'Ordine già effettuato'
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_008: dormiente (nessun movimento recente)
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  ultimo_movimento_at
) VALUES (
  'aaaaaaaa-aa08-aa08-aa08-aaaaaaaaaaaa',
  'TEST_AI_008 Prodotto Dormiente',
  'DPI & Sterilizzazione', 5, 2, 'pz', 'bassa', false,
  (now() - interval '200 days')
) ON CONFLICT (id) DO NOTHING;

-- TEST_AI_009: campo lotto valorizzato
INSERT INTO public.magazzino (
  id, prodotto, categoria, quantita, soglia_minima, unita, priorita, alert_silenziato,
  lotto
) VALUES (
  'aaaaaaaa-aa09-aa09-aa09-aaaaaaaaaaaa',
  'TEST_AI_009 Con Lotto',
  'Compositi & Cementi', 12, 3, 'pz', 'normale', false,
  'LOT-2024-TEST-001'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BLOCCO 2: MOVIMENTI — Inserimento movimenti per TEST_AI_001
-- (simula scarichi per calcolo consumo)
-- ============================================================

INSERT INTO public.magazzino_movimenti (
  magazzino_id, tipo, quantita_delta, quantita_prima, quantita_dopo, note
) VALUES
  ('aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa', 'carico_manuale',  10,  0, 10, 'OST: carico iniziale'),
  ('aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa', 'scarico_manuale', -3, 10,  7, 'OST: scarico 3pz'),
  ('aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa', 'scarico_manuale', -2,  7,  5, 'OST: scarico 2pz'),
  ('aaaaaaaa-aa02-aa02-aa02-aaaaaaaaaaaa', 'carico_manuale',   5,  0,  5, 'OST: carico TEST_AI_002'),
  ('aaaaaaaa-aa02-aa02-aa02-aaaaaaaaaaaa', 'scarico_manuale', -4,  5,  1, 'OST: scarico critico');

-- ============================================================
-- BLOCCO 3: VERIFICA — Query per validazione manuale
-- ============================================================

-- T01: Verifica prodotti inseriti (deve restituire 9 righe)
SELECT id, prodotto, quantita, soglia_minima, priorita, alert_silenziato, scadenza, lotto
FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%'
ORDER BY prodotto;

-- T02: Sotto soglia non silenziati (deve restituire TEST_AI_002 only)
SELECT prodotto, quantita, soglia_minima, priorita
FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%'
  AND quantita < soglia_minima
  AND alert_silenziato = false;

-- T03: Silenziati sotto soglia (deve restituire TEST_AI_003 e TEST_AI_007)
SELECT prodotto, quantita, soglia_minima, alert_silenziato_motivo
FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%'
  AND alert_silenziato = true;

-- T04: Scaduti (deve restituire TEST_AI_004)
SELECT prodotto, scadenza
FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%'
  AND scadenza IS NOT NULL
  AND scadenza < current_date::text;

-- T05: In scadenza entro 30 gg (deve restituire TEST_AI_005 e TEST_AI_007)
SELECT prodotto, scadenza
FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%'
  AND scadenza >= current_date::text
  AND scadenza <= (current_date + interval '30 days')::date::text;

-- T06: In scadenza entro 90 gg (deve restituire TEST_AI_005, 006, 007)
SELECT prodotto, scadenza
FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%'
  AND scadenza >= current_date::text
  AND scadenza <= (current_date + interval '90 days')::date::text;

-- T07: TEST_AI_007 silenziato MA con scadenza (badge scadenza deve essere visibile)
SELECT prodotto, alert_silenziato, scadenza
FROM public.magazzino
WHERE id = 'aaaaaaaa-aa07-aa07-aa07-aaaaaaaaaaaa';

-- T08: Movimenti inseriti per TEST_AI_001 e TEST_AI_002
SELECT m.tipo, m.quantita_delta, m.quantita_prima, m.quantita_dopo, m.note
FROM public.magazzino_movimenti m
WHERE m.magazzino_id IN (
  'aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa',
  'aaaaaaaa-aa02-aa02-aa02-aaaaaaaaaaaa'
)
ORDER BY m.created_at;

-- T09: Consumo TEST_AI_001 (scarichi = -3 + -2 = 5 in N giorni)
SELECT
  magazzino_id,
  SUM(ABS(quantita_delta)) AS totale_consumato,
  COUNT(*)                 AS num_scarichi
FROM public.magazzino_movimenti
WHERE magazzino_id = 'aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa'
  AND tipo IN ('scarico_manuale', 'rettifica')
  AND quantita_delta < 0;

-- T10: Dormiente TEST_AI_008 (ultimo_movimento_at > 180 gg fa)
SELECT prodotto,
  EXTRACT(DAY FROM (now() - ultimo_movimento_at))::int AS gg_senza_movimento
FROM public.magazzino
WHERE id = 'aaaaaaaa-aa08-aa08-aa08-aaaaaaaaaaaa';

-- T11: Lotto TEST_AI_009
SELECT prodotto, lotto
FROM public.magazzino
WHERE id = 'aaaaaaaa-aa09-aa09-aa09-aaaaaaaaaaaa';

-- T12: Settings magazzino v2 (deve avere almeno 5 chiavi)
SELECT chiave, valore FROM public.settings
WHERE sezione = 'magazzino'
ORDER BY chiave;

-- T13: Tabella magazzino_movimenti esiste e ha RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'magazzino_movimenti';

-- T14: Policy RLS su magazzino_movimenti (deve esistere almeno 1 policy)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'magazzino_movimenti';

-- T15: Nessun movimento con tipo non consentito (check constraint)
-- (questo deve restituire 0 righe se il check constraint è attivo)
SELECT COUNT(*) AS violazioni
FROM public.magazzino_movimenti
WHERE tipo NOT IN ('carico_manuale','scarico_manuale','ricezione_ordine','rettifica','rollback');

-- ============================================================
-- BLOCCO 4: CLEANUP — Rimozione dati di test
-- Eseguire DOPO la verifica manuale
-- ============================================================

DELETE FROM public.magazzino_movimenti
WHERE magazzino_id IN (
  'aaaaaaaa-aa01-aa01-aa01-aaaaaaaaaaaa',
  'aaaaaaaa-aa02-aa02-aa02-aaaaaaaaaaaa',
  'aaaaaaaa-aa03-aa03-aa03-aaaaaaaaaaaa',
  'aaaaaaaa-aa04-aa04-aa04-aaaaaaaaaaaa',
  'aaaaaaaa-aa05-aa05-aa05-aaaaaaaaaaaa',
  'aaaaaaaa-aa06-aa06-aa06-aaaaaaaaaaaa',
  'aaaaaaaa-aa07-aa07-aa07-aaaaaaaaaaaa',
  'aaaaaaaa-aa08-aa08-aa08-aaaaaaaaaaaa',
  'aaaaaaaa-aa09-aa09-aa09-aaaaaaaaaaaa'
);

DELETE FROM public.magazzino
WHERE prodotto LIKE 'TEST_AI_%';

-- Verifica cleanup completato (deve restituire 0 righe)
SELECT COUNT(*) FROM public.magazzino WHERE prodotto LIKE 'TEST_AI_%';
