-- =============================================================================
-- RIDENTIUM — Adempimenti normativi (Cap. 23 della Guida Normativa)
-- =============================================================================
-- Crea il modulo "Adempimenti" per gestire tutti gli obblighi ricorrenti
-- dello studio (daily → quinquennale), con responsabile, evidenza documentale,
-- preavviso e storico esecuzioni.
--
-- Idempotente: può essere rieseguita senza errori.
-- =============================================================================


-- ── 1. Tabella consulenti (esterni: RSPP, DPO, Commercialista, ecc.) ─────────
CREATE TABLE IF NOT EXISTS public.consulenti (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruolo      TEXT NOT NULL,    -- 'RSPP','DPO','MC','ERP','Commercialista','ConsulenteLavoro','Broker','ManutentoreAutoclave','ManutentoreCBCT','ManutentoreRiuniti','ManutentoreCompressore','LaboratorioAnalisi','DittaRifiuti','Altro'
  nome       TEXT NOT NULL,
  email      TEXT,
  telefono   TEXT,
  note       TEXT,
  attivo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consulenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consulenti_read_team"  ON public.consulenti;
DROP POLICY IF EXISTS "consulenti_write_admin" ON public.consulenti;

-- Tutti gli utenti autenticati del team possono leggerli (servono per mostrare il responsabile).
CREATE POLICY "consulenti_read_team" ON public.consulenti
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admin/manager possono modificarli.
CREATE POLICY "consulenti_write_admin" ON public.consulenti
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo IN ('admin','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo IN ('admin','manager'))
  );


-- ── 2. Tabella adempimenti (anagrafica degli obblighi ricorrenti) ───────────
CREATE TABLE IF NOT EXISTS public.adempimenti (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo                  TEXT NOT NULL,
  descrizione             TEXT,
  categoria               TEXT NOT NULL,  -- es. 'sterilizzazione','rifiuti','fiscale','radioprotezione',…
  frequenza               TEXT NOT NULL CHECK (frequenza IN (
                            'giornaliero','settimanale','mensile','trimestrale',
                            'semestrale','annuale','biennale','triennale','quinquennale'
                          )),
  responsabile_profilo_id UUID REFERENCES public.profili(id) ON DELETE SET NULL,
  consulente_id           UUID REFERENCES public.consulenti(id) ON DELETE SET NULL,
  responsabile_etichetta  TEXT,  -- nome del ruolo interno in chiaro (es. "ASO di apertura") quando non mappato a profilo
  evidenza_richiesta      TEXT,  -- es. "F24 quietanzato", "Bolla intervento", "Verbale"
  riferimento_normativo   TEXT,  -- es. "D.Lgs. 81/2008", "Intesa Stato-Regioni 2016"
  preavviso_giorni        INTEGER NOT NULL DEFAULT 30,  -- giorni di anticipo per allarme giallo
  prossima_scadenza       DATE,  -- ricalcolata al completamento
  ultima_esecuzione       TIMESTAMPTZ,
  attivo                  BOOLEAN NOT NULL DEFAULT TRUE,
  note                    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adempimenti_scadenza
  ON public.adempimenti(prossima_scadenza) WHERE attivo = TRUE;
CREATE INDEX IF NOT EXISTS idx_adempimenti_categoria
  ON public.adempimenti(categoria) WHERE attivo = TRUE;

ALTER TABLE public.adempimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adempimenti_read_team"   ON public.adempimenti;
DROP POLICY IF EXISTS "adempimenti_write_admin" ON public.adempimenti;

-- Tutti gli autenticati del team possono leggerli.
CREATE POLICY "adempimenti_read_team" ON public.adempimenti
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admin/manager creano/modificano/disattivano.
CREATE POLICY "adempimenti_write_admin" ON public.adempimenti
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo IN ('admin','manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profili WHERE id = auth.uid() AND ruolo IN ('admin','manager'))
  );


-- ── 3. Tabella adempimenti_esecuzioni (storico esecuzioni = audit trail) ────
CREATE TABLE IF NOT EXISTS public.adempimenti_esecuzioni (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adempimento_id         UUID NOT NULL REFERENCES public.adempimenti(id) ON DELETE CASCADE,
  data_scadenza          DATE,  -- era prevista per (snapshot)
  data_esecuzione        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eseguito_da_profilo_id UUID REFERENCES public.profili(id) ON DELETE SET NULL,
  eseguito_da_nome       TEXT,  -- snapshot nome (utile anche quando è consulente esterno)
  note                   TEXT,
  evidenza_descrizione   TEXT,  -- es. "Bolla n. 12345 del 22/04/2026"
  evidenza_url           TEXT,  -- URL Storage / link esterno / vuoto
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adempimenti_esec_adempimento
  ON public.adempimenti_esecuzioni(adempimento_id, data_esecuzione DESC);

ALTER TABLE public.adempimenti_esecuzioni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "esecuzioni_read_team"  ON public.adempimenti_esecuzioni;
DROP POLICY IF EXISTS "esecuzioni_insert_team" ON public.adempimenti_esecuzioni;

CREATE POLICY "esecuzioni_read_team" ON public.adempimenti_esecuzioni
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Tutti gli autenticati (admin, manager, segretaria, aso, clinico) possono segnare un adempimento come eseguito.
CREATE POLICY "esecuzioni_insert_team" ON public.adempimenti_esecuzioni
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ── 4. Helper: calcola prossima scadenza dato frequenza + data di partenza ─
CREATE OR REPLACE FUNCTION public.adempimenti_prossima_scadenza(
  p_frequenza TEXT,
  p_base      DATE
) RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_frequenza
    WHEN 'giornaliero'  THEN p_base + INTERVAL '1 day'
    WHEN 'settimanale'  THEN p_base + INTERVAL '7 days'
    WHEN 'mensile'      THEN p_base + INTERVAL '1 month'
    WHEN 'trimestrale'  THEN p_base + INTERVAL '3 months'
    WHEN 'semestrale'   THEN p_base + INTERVAL '6 months'
    WHEN 'annuale'      THEN p_base + INTERVAL '1 year'
    WHEN 'biennale'     THEN p_base + INTERVAL '2 years'
    WHEN 'triennale'    THEN p_base + INTERVAL '3 years'
    WHEN 'quinquennale' THEN p_base + INTERVAL '5 years'
    ELSE p_base
  END::DATE;
$$;


-- ── 5. RPC: completa un adempimento (log + riscadenza in una sola transazione) ─
CREATE OR REPLACE FUNCTION public.completa_adempimento(
  p_adempimento_id        UUID,
  p_note                  TEXT DEFAULT NULL,
  p_evidenza_descrizione  TEXT DEFAULT NULL,
  p_evidenza_url          TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_frequenza       TEXT;
  v_vecchia_scad    DATE;
  v_nuova_scad      DATE;
  v_user_id         UUID;
  v_user_nome       TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  -- Snapshot del nome dell'utente per il log
  SELECT COALESCE(nome || ' ' || cognome, email) INTO v_user_nome
    FROM public.profili WHERE id = v_user_id;

  -- Lock sull'adempimento ed estrai frequenza + vecchia scadenza
  SELECT frequenza, prossima_scadenza
    INTO v_frequenza, v_vecchia_scad
    FROM public.adempimenti
   WHERE id = p_adempimento_id
   FOR UPDATE;

  IF v_frequenza IS NULL THEN
    RAISE EXCEPTION 'Adempimento non trovato';
  END IF;

  -- Calcola nuova scadenza dalla data odierna (non dalla vecchia: se si paga un F24
  -- in ritardo, il prossimo è tra un mese da oggi, non un mese dalla scadenza originale).
  v_nuova_scad := public.adempimenti_prossima_scadenza(v_frequenza, CURRENT_DATE);

  -- Log dell'esecuzione
  INSERT INTO public.adempimenti_esecuzioni
    (adempimento_id, data_scadenza, eseguito_da_profilo_id, eseguito_da_nome,
     note, evidenza_descrizione, evidenza_url)
  VALUES
    (p_adempimento_id, v_vecchia_scad, v_user_id, v_user_nome,
     p_note, p_evidenza_descrizione, p_evidenza_url);

  -- Aggiorna l'adempimento con nuova scadenza
  UPDATE public.adempimenti
     SET ultima_esecuzione = NOW(),
         prossima_scadenza = v_nuova_scad,
         updated_at = NOW()
   WHERE id = p_adempimento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'prossima_scadenza', v_nuova_scad,
    'eseguito_da', v_user_nome
  );
END;
$$;

REVOKE ALL ON FUNCTION public.completa_adempimento(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.completa_adempimento(UUID, TEXT, TEXT, TEXT) TO authenticated;


-- ── 6. Seed dei consulenti tipo (stub, Mariano poi aggiorna con nomi reali) ─
INSERT INTO public.consulenti (ruolo, nome, note) VALUES
  ('Commercialista',         'Commercialista — da assegnare', 'Aggiornare con nome, email, telefono'),
  ('ConsulenteLavoro',       'Consulente del lavoro — da assegnare', NULL),
  ('RSPP',                   'RSPP — da assegnare', 'Responsabile Servizio Prevenzione e Protezione'),
  ('DPO',                    'DPO — da assegnare', 'Data Protection Officer'),
  ('MC',                     'Medico competente — da assegnare', 'Sorveglianza sanitaria lavoratori'),
  ('ERP',                    'Esperto radioprotezione — da assegnare', NULL),
  ('Broker',                 'Broker assicurativo — da assegnare', 'Polizza responsabilità professionale'),
  ('ManutentoreAutoclave',   'Ditta manutenzione autoclave — da assegnare', NULL),
  ('ManutentoreCBCT',        'Ditta Carestream — da assegnare', 'Manutenzione CBCT'),
  ('ManutentoreRiuniti',     'Ditta manutenzione riuniti — da assegnare', NULL),
  ('ManutentoreCompressore', 'Ditta manutenzione compressore/aspirazione — da assegnare', NULL),
  ('LaboratorioAnalisi',     'Laboratorio analisi acque — da assegnare', 'Controllo microbiologico legionella'),
  ('DittaRifiuti',           'Ditta smaltimento rifiuti sanitari — da assegnare', NULL)
ON CONFLICT DO NOTHING;


-- ── 7. Seed degli adempimenti dal Cap. 23 della Guida Normativa ─────────────
-- Helper: inserisce solo se un adempimento col medesimo titolo non esiste già.

DO $$
DECLARE
  v_cons_commercialista UUID;
  v_cons_lavoro         UUID;
  v_cons_rspp           UUID;
  v_cons_dpo            UUID;
  v_cons_mc             UUID;
  v_cons_erp            UUID;
  v_cons_broker         UUID;
  v_cons_aut            UUID;
  v_cons_cbct           UUID;
  v_cons_riuniti        UUID;
  v_cons_compressore    UUID;
  v_cons_lab            UUID;
  v_cons_rifiuti        UUID;
  v_domani              DATE := CURRENT_DATE + 1;
  v_fine_mese           DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
  v_fine_trim           DATE := (DATE_TRUNC('quarter', CURRENT_DATE) + INTERVAL '3 months - 1 day')::DATE;
  v_fine_sem            DATE := CURRENT_DATE + INTERVAL '6 months';
  v_fine_anno           DATE := (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::DATE;
BEGIN
  SELECT id INTO v_cons_commercialista FROM public.consulenti WHERE ruolo='Commercialista' LIMIT 1;
  SELECT id INTO v_cons_lavoro         FROM public.consulenti WHERE ruolo='ConsulenteLavoro' LIMIT 1;
  SELECT id INTO v_cons_rspp           FROM public.consulenti WHERE ruolo='RSPP' LIMIT 1;
  SELECT id INTO v_cons_dpo            FROM public.consulenti WHERE ruolo='DPO' LIMIT 1;
  SELECT id INTO v_cons_mc             FROM public.consulenti WHERE ruolo='MC' LIMIT 1;
  SELECT id INTO v_cons_erp            FROM public.consulenti WHERE ruolo='ERP' LIMIT 1;
  SELECT id INTO v_cons_broker         FROM public.consulenti WHERE ruolo='Broker' LIMIT 1;
  SELECT id INTO v_cons_aut            FROM public.consulenti WHERE ruolo='ManutentoreAutoclave' LIMIT 1;
  SELECT id INTO v_cons_cbct           FROM public.consulenti WHERE ruolo='ManutentoreCBCT' LIMIT 1;
  SELECT id INTO v_cons_riuniti        FROM public.consulenti WHERE ruolo='ManutentoreRiuniti' LIMIT 1;
  SELECT id INTO v_cons_compressore    FROM public.consulenti WHERE ruolo='ManutentoreCompressore' LIMIT 1;
  SELECT id INTO v_cons_lab            FROM public.consulenti WHERE ruolo='LaboratorioAnalisi' LIMIT 1;
  SELECT id INTO v_cons_rifiuti        FROM public.consulenti WHERE ruolo='DittaRifiuti' LIMIT 1;

  -- Se ci sono già adempimenti, skip (seed già eseguito prima)
  IF EXISTS (SELECT 1 FROM public.adempimenti LIMIT 1) THEN
    RAISE NOTICE 'Adempimenti già presenti, skip seed.';
    RETURN;
  END IF;

  INSERT INTO public.adempimenti (titolo, descrizione, categoria, frequenza, responsabile_etichetta, consulente_id, evidenza_richiesta, riferimento_normativo, preavviso_giorni, prossima_scadenza) VALUES

  -- ═══ GIORNALIERI ═══
  ('Apertura: verifica temperatura frigo farmaci', 'Controllo all''apertura della temperatura del frigorifero farmaci/vaccini. Annotare sul registro.', 'apertura_chiusura', 'giornaliero', 'Assistente di apertura', NULL, 'Registro temperature', 'D.Lgs. 219/2006 (farmaci); buone pratiche ASL', 1, v_domani),
  ('Apertura linee idriche riunito (flushing)', 'Scarico 2 minuti su ogni riunito a inizio giornata. Previene contaminazione biofilm/legionella.', 'legionella', 'giornaliero', 'ASO', NULL, 'Registro legionella/linee', 'D.Lgs. 81/2008 + Linee guida legionellosi 2015', 1, v_domani),
  ('Preparazione materiale sterile del giorno', 'Verifica stock strumenti sterilizzati pronti all''uso e rotazione per data.', 'sterilizzazione', 'giornaliero', 'Responsabile sterilizzazione', NULL, 'Verifica stoccaggio', 'UNI EN ISO 17665; ISS 2020', 1, v_domani),
  ('Decontaminazione strumenti ad ogni paziente', 'Pre-detersione e decontaminazione chimica secondo protocollo.', 'sterilizzazione', 'giornaliero', 'ASO', NULL, 'Protocollo applicato', 'D.M. 28/09/1990; ISS 2020', 1, v_domani),
  ('Scarico linee riunito tra pazienti (30s)', 'Flushing 30 secondi tra un paziente e il successivo sulle linee attive.', 'legionella', 'giornaliero', 'ASO', NULL, 'Protocollo applicato', 'Linee guida legionellosi 2015', 1, v_domani),
  ('Gestione rifiuti: conferimento in contenitori dedicati', 'Separazione rifiuti sanitari pericolosi a rischio infettivo (HP9) in HALIPAC/cartoni dedicati.', 'rifiuti', 'giornaliero', 'Operatore/ASO', NULL, 'Procedura applicata', 'D.P.R. 254/2003; D.Lgs. 152/2006', 1, v_domani),
  ('Registrazione esposizioni radiologiche', 'Per ogni prestazione con CBCT/endorale: annotare in cartella dose e giustificazione.', 'radioprotezione', 'giornaliero', 'Medico/ASO', NULL, 'Software CBCT + cartella clinica', 'D.Lgs. 101/2020', 1, v_domani),
  ('Compilazione cartella clinica a fine prestazione', 'Diagnosi, trattamento, note e firma. Obbligo documentale sanitario.', 'clinico', 'giornaliero', 'Medico', NULL, 'Cartella clinica digitale', 'Codice deontologico; GDPR', 1, v_domani),
  ('Verifica consensi informati firmati prima della prestazione', 'Controllo firma paziente su consenso informato specifico.', 'clinico', 'giornaliero', 'Medico', NULL, 'Cartella clinica', 'Legge 219/2017', 1, v_domani),
  ('Chiusura: scarico linee + spegnimento compressore', 'Scarico finale linee riunito + spegnimento compressore e aspirazione.', 'apertura_chiusura', 'giornaliero', 'ASO/Responsabile', NULL, 'Registro legionella', 'Linee guida legionellosi 2015', 1, v_domani),
  ('Chiusura cassa e riconciliazione pagamenti', 'Controllo incassi giornalieri vs scontrini/fatture.', 'amministrativo', 'giornaliero', 'Segreteria', NULL, 'Report gestionale', 'Normativa fiscale generale', 1, v_domani),

  -- ═══ SETTIMANALI ═══
  ('Test indicatore biologico autoclave', 'Spore test (Geobacillus stearothermophilus) per verificare efficacia sterilizzazione.', 'sterilizzazione', 'settimanale', 'Responsabile sterilizzazione', NULL, 'Registro sterilizzazioni', 'UNI EN ISO 11138; ISS 2020', 3, v_domani + 6),
  ('Bowie-Dick test autoclave', 'Test di penetrazione del vapore. Obbligatorio settimanale per autoclavi classe B.', 'sterilizzazione', 'settimanale', 'Responsabile sterilizzazione', NULL, 'Registro sterilizzazioni', 'UNI EN ISO 11140; UNI EN 13060', 3, v_domani + 6),
  ('Sanificazione aspirazione chirurgica', 'Prodotto dedicato per disinfezione circuiti aspirazione. Una volta a settimana.', 'legionella', 'settimanale', 'ASO', NULL, 'Registro manutenzioni', 'Buone pratiche; Linee guida legionellosi', 3, v_domani + 6),
  ('Pulizia approfondita ambienti clinici', 'Sanificazione spinta tutti i locali clinici (non solo ordinaria).', 'legionella', 'settimanale', 'Impresa pulizie/ASO', NULL, 'Programma pulizie', 'Linee guida ISS 2020', 3, v_domani + 6),
  ('Verifica scorte materiale sterile e consumabili', 'Controllo giacenze e ordine preventivo.', 'amministrativo', 'settimanale', 'Responsabile magazzino', NULL, 'Report inventario', 'Buone pratiche', 2, v_domani + 6),
  ('Riunione di coordinamento team', 'Briefing team settimanale — obiettivi, criticità, casi difficili.', 'audit', 'settimanale', 'Titolare', NULL, 'Verbale sintetico', 'Buone pratiche organizzative', 2, v_domani + 6),
  ('Backup gestionale verificato', 'Conferma che il backup dei dati gestionale sia andato a buon fine.', 'privacy', 'settimanale', 'IT/Titolare', NULL, 'Log di backup', 'GDPR art. 32', 2, v_domani + 6),

  -- ═══ MENSILI ═══
  ('Conferimento rifiuti sanitari a ditta autorizzata', 'Ritiro rifiuti HP9 da parte di trasportatore autorizzato. FIR firmato.', 'rifiuti', 'mensile', NULL, v_cons_rifiuti, 'FIR + registro C/S', 'D.Lgs. 152/2006; D.P.R. 254/2003', 7, v_fine_mese),
  ('Aggiornamento registro carico/scarico rifiuti', 'Vidimazione e aggiornamento pagine registro movimenti rifiuti.', 'rifiuti', 'mensile', 'Responsabile rifiuti', NULL, 'Registro carico/scarico', 'D.Lgs. 152/2006', 5, v_fine_mese),
  ('Versamento contributi personale (F24)', 'F24 contributi INPS/INAIL + ritenute d''acconto dipendenti.', 'fiscale', 'mensile', NULL, v_cons_commercialista, 'F24 quietanzato', 'D.P.R. 600/1973', 5, v_fine_mese),
  ('Elaborazione paghe e LUL', 'Cedolini mensili + Libro Unico del Lavoro.', 'fiscale', 'mensile', NULL, v_cons_lavoro, 'Cedolini + LUL', 'D.Lgs. 151/2001; L. 52/1996', 5, v_fine_mese),
  ('Liquidazione IVA mensile (se applicabile)', 'Se regime IVA mensile: F24 + LIPE trimestrale.', 'fiscale', 'mensile', NULL, v_cons_commercialista, 'F24 + LIPE', 'D.P.R. 633/1972', 5, v_fine_mese),
  ('Controllo funzionale interruttori differenziali', 'Test pulsante "T" su ogni salvavita. Verifica sgancio.', 'manutenzione', 'mensile', 'Responsabile tecnico interno', NULL, 'Registro manutenzioni', 'CEI 64-8; D.Lgs. 81/2008', 3, v_fine_mese),
  ('Riconciliazione incassi e pagamenti', 'Quadratura contabile mensile in collaborazione col commercialista.', 'amministrativo', 'mensile', 'Segreteria', v_cons_commercialista, 'Report contabile', 'Buone pratiche contabili', 3, v_fine_mese),
  ('Verifica scadenze formative in approssimazione', 'Controllo mappa formazione personale: quali corsi scadono entro 6 mesi.', 'formazione', 'mensile', 'Clinic manager', NULL, 'Scheda personale', 'D.Lgs. 81/2008; Accordo Stato-Regioni 2011', 3, v_fine_mese),
  ('Revisione segnalazioni e reclami del mese', 'Riesame reclami pazienti e segnalazioni staff.', 'audit', 'mensile', 'Direttore sanitario', NULL, 'Registro reclami', 'L. 24/2017 (Gelli-Bianco)', 3, v_fine_mese),
  ('Controllo qualità di base CBCT', 'Test pattern e routine check previsti dal protocollo interno.', 'radioprotezione', 'mensile', 'Responsabile tecnico', NULL, 'Programma QA', 'D.Lgs. 101/2020', 3, v_fine_mese),

  -- ═══ TRIMESTRALI ═══
  ('Lettura dosimetri personali', 'Raccolta dosimetri lavoratori esposti + invio al servizio dosimetrico.', 'radioprotezione', 'trimestrale', NULL, v_cons_erp, 'Referto dosimetrico', 'D.Lgs. 101/2020', 15, v_fine_trim),
  ('Comunicazione periodica IVA / LIPE', 'Se applicabile: LIPE trimestrale.', 'fiscale', 'trimestrale', NULL, v_cons_commercialista, 'Invio telematico', 'D.L. 78/2010', 15, v_fine_trim),
  ('Trattamento periodico disinfezione linee riunito', 'Disinfezione sistemica linee idriche riuniti (protocollo dedicato).', 'legionella', 'trimestrale', 'ASO/Responsabile', NULL, 'Registro legionella', 'Linee guida legionellosi 2015', 10, v_fine_trim),
  ('Riunione coordinamento consulenti', 'Meeting congiunto con RSPP, DPO, ERP per allineamento.', 'audit', 'trimestrale', 'Titolare', NULL, 'Verbale', 'Buone pratiche', 15, v_fine_trim),
  ('Verifica giacenze e rotazione farmaci per scadenza', 'Controllo date di scadenza farmaci in studio (anestetici, antibiotici).', 'clinico', 'trimestrale', 'Responsabile magazzino', NULL, 'Registro farmaci', 'D.Lgs. 219/2006', 10, v_fine_trim),
  ('Invio Sistema TS', 'Trasmissione spese sanitarie detraibili al Sistema Tessera Sanitaria.', 'sistema_ts', 'trimestrale', NULL, v_cons_commercialista, 'Ricevuta STS', 'D.Lgs. 175/2014', 15, v_fine_trim),

  -- ═══ SEMESTRALI ═══
  ('Controllo qualità CBCT da parte dell''Esperto radioprotezione', 'QC approfondito apparecchiatura radiologica.', 'radioprotezione', 'semestrale', NULL, v_cons_erp, 'Verbale controllo', 'D.Lgs. 101/2020', 30, v_fine_sem),
  ('Controllo microbiologico acque riunito (legionella)', 'Campionamento e analisi laboratorio acque riuniti.', 'legionella', 'semestrale', NULL, v_cons_lab, 'Rapporto analisi', 'Linee guida legionellosi 2015', 30, v_fine_sem),
  ('Verifica stato avanzamento formazione personale', 'Mappatura completa scadenze formative a 6 mesi.', 'formazione', 'semestrale', 'Clinic manager', NULL, 'Mappa formazione', 'D.Lgs. 81/2008', 30, v_fine_sem),
  ('Revisione aggiornamenti normativi con consulenti', 'Review aggiornamenti legislativi degli ultimi 6 mesi.', 'audit', 'semestrale', 'Titolare', NULL, 'Nota di revisione', 'Buone pratiche', 30, v_fine_sem),
  ('Test ripristino backup gestionale', 'Prova effettiva di restore da backup. Non basta il backup!', 'privacy', 'semestrale', 'IT/DPO', v_cons_dpo, 'Verbale test', 'GDPR art. 32', 30, v_fine_sem),
  ('Revisione scorte DPI e presidi di emergenza', 'Check scadenze DPI, defibrillatore, kit emergenza.', 'sicurezza', 'semestrale', 'Responsabile magazzino', NULL, 'Report', 'D.Lgs. 81/2008', 30, v_fine_sem),
  ('Aggiornamento versione Guida Normativa', 'Review e aggiornamento versione Guida con consulenti.', 'audit', 'semestrale', 'Titolare', NULL, 'Versione n+1', 'Buone pratiche documentali', 30, v_fine_sem),

  -- ═══ ANNUALI ═══
  ('Visita medica annuale personale (sorveglianza sanitaria)', 'Visita medica di tutti i lavoratori soggetti a sorveglianza.', 'sicurezza', 'annuale', NULL, v_cons_mc, 'Giudizio di idoneità', 'D.Lgs. 81/2008 art. 41', 60, v_fine_anno),
  ('Sopralluogo annuale Medico Competente nei locali', 'MC visita i luoghi di lavoro almeno una volta all''anno.', 'sicurezza', 'annuale', NULL, v_cons_mc, 'Verbale sopralluogo', 'D.Lgs. 81/2008 art. 25', 60, v_fine_anno),
  ('Revisione annuale DVR', 'Aggiornamento Documento Valutazione Rischi insieme al RSPP.', 'sicurezza', 'annuale', NULL, v_cons_rspp, 'DVR aggiornato', 'D.Lgs. 81/2008 art. 28', 60, v_fine_anno),
  ('Riunione periodica della sicurezza', 'Riunione annuale titolare + RSPP + MC + RLS (consigliata).', 'sicurezza', 'annuale', 'Titolare', v_cons_rspp, 'Verbale', 'D.Lgs. 81/2008 art. 35', 30, v_fine_anno),
  ('Manutenzione programmata autoclave', 'Intervento tecnico autorizzato su autoclave B.', 'manutenzione', 'annuale', NULL, v_cons_aut, 'Bolla intervento', 'UNI EN 13060; dir. 2014/68/UE', 45, v_fine_anno),
  ('Manutenzione programmata CBCT', 'Intervento tecnico Carestream o ditta autorizzata.', 'manutenzione', 'annuale', NULL, v_cons_cbct, 'Bolla intervento', 'D.Lgs. 101/2020; manuale produttore', 45, v_fine_anno),
  ('Manutenzione programmata riuniti', 'Intervento tecnico annuale su ogni riunito.', 'manutenzione', 'annuale', NULL, v_cons_riuniti, 'Bolla intervento', 'UNI EN ISO 7494', 30, v_fine_anno),
  ('Manutenzione programmata compressore e aspirazione', 'Intervento tecnico compressore + impianto aspirazione.', 'manutenzione', 'annuale', NULL, v_cons_compressore, 'Bolla intervento', 'D.M. 329/2004; D.Lgs. 81/2008', 30, v_fine_anno),
  ('Dichiarazione dei redditi', 'Modello UNICO/730 annuale.', 'fiscale', 'annuale', NULL, v_cons_commercialista, 'Modello UNICO/730', 'D.P.R. 917/1986', 60, v_fine_anno),
  ('Dichiarazione IRAP', 'Se applicabile.', 'fiscale', 'annuale', NULL, v_cons_commercialista, 'Modello IRAP', 'D.Lgs. 446/1997', 60, v_fine_anno),
  ('Certificazione Unica (marzo)', 'CU per collaboratori e dipendenti, scadenza 16 marzo.', 'fiscale', 'annuale', NULL, v_cons_lavoro, 'CU', 'D.P.R. 322/1998', 30, v_fine_anno),
  ('MUD rifiuti (se applicabile)', 'Modello Unico Dichiarazione Ambientale — scadenza 30 aprile.', 'rifiuti', 'annuale', NULL, v_cons_commercialista, 'MUD', 'D.Lgs. 152/2006 art. 189', 30, v_fine_anno),
  ('Rinnovo polizza responsabilità professionale', 'Rinnovo copertura assicurativa.', 'albo_assicurazioni', 'annuale', NULL, v_cons_broker, 'Polizza firmata', 'L. 24/2017 (Gelli-Bianco)', 30, v_fine_anno),
  ('Rinnovo iscrizione albo e quota ENPAM', 'Pagamento quota annuale Ordine + ENPAM.', 'albo_assicurazioni', 'annuale', 'Titolare', NULL, 'Ricevute', 'D.Lgs. 233/1946', 30, v_fine_anno),
  ('Autoverifica con checklist ispezione', 'Autoaudit annuale con la checklist del Capitolo 25 della Guida.', 'audit', 'annuale', 'Titolare', v_cons_rspp, 'Checklist compilata', 'Buone pratiche', 30, v_fine_anno),
  ('Aggiornamento registro trattamenti GDPR', 'Review annuale registro attività di trattamento.', 'privacy', 'annuale', 'Titolare', v_cons_dpo, 'Registro aggiornato', 'GDPR art. 30', 30, v_fine_anno),
  ('Revisione contratti con responsabili esterni (GDPR)', 'Rinnovo/verifica DPA con fornitori che trattano dati personali.', 'privacy', 'annuale', 'Titolare', v_cons_dpo, 'Contratti rinnovati', 'GDPR art. 28', 30, v_fine_anno),
  ('Bilancio gestionale e pianificazione anno successivo', 'Chiusura contabile + piano economico anno n+1.', 'amministrativo', 'annuale', 'Titolare', v_cons_commercialista, 'Piano', 'Buone pratiche', 30, v_fine_anno),

  -- ═══ PLURIENNALI ═══
  ('Verifica impianto di terra', 'Verifica biennale impianto messa a terra a cura di organismo abilitato.', 'manutenzione', 'biennale', NULL, NULL, 'Verbale verifica', 'D.P.R. 462/2001', 90, CURRENT_DATE + INTERVAL '2 years'),
  ('Aggiornamento formazione preposti', '6 ore di aggiornamento ogni 2 anni per chi è preposto alla sicurezza.', 'formazione', 'biennale', 'Preposti/Titolare', NULL, 'Attestato', 'Accordo Stato-Regioni 21/12/2011', 90, CURRENT_DATE + INTERVAL '2 years'),
  ('Aggiornamento formazione addetti antincendio', 'Rinnovo formazione addetti prevenzione incendi.', 'formazione', 'quinquennale', 'Addetti antincendio', NULL, 'Attestato', 'D.M. 2 settembre 2021', 90, CURRENT_DATE + INTERVAL '5 years'),
  ('Aggiornamento formazione lavoratori (6 ore)', 'Rinnovo quinquennale formazione base lavoratori.', 'formazione', 'quinquennale', 'Tutti i lavoratori', NULL, 'Attestati', 'Accordo Stato-Regioni 21/12/2011', 120, CURRENT_DATE + INTERVAL '5 years'),
  ('Aggiornamento formazione RSPP datore di lavoro', 'Se il titolare è anche RSPP: rinnovo quinquennale.', 'formazione', 'quinquennale', 'Titolare', NULL, 'Attestato', 'D.Lgs. 81/2008; Accordo Stato-Regioni 2016', 120, CURRENT_DATE + INTERVAL '5 years'),
  ('Verifica periodica attrezzature a pressione (compressore)', 'Ispezione organismo notificato per compressore.', 'manutenzione', 'quinquennale', NULL, NULL, 'Verbale ispezione', 'D.M. 329/2004', 90, CURRENT_DATE + INTERVAL '5 years'),
  ('Bilancio triennale ECM', 'Verifica completamento crediti ECM triennio.', 'formazione', 'triennale', 'Titolare e professionisti', NULL, 'Report ECM', 'D.Lgs. 502/1992 art. 16-bis', 120, CURRENT_DATE + INTERVAL '3 years'),
  ('Aggiornamento formazione primo soccorso', 'Rinnovo triennale formazione addetti primo soccorso.', 'formazione', 'triennale', 'Addetti primo soccorso', NULL, 'Attestato', 'D.M. 388/2003', 120, CURRENT_DATE + INTERVAL '3 years');

  RAISE NOTICE 'Seed adempimenti completato.';
END $$;


-- =============================================================================
-- FINE migrazione. Il modulo Adempimenti è pronto.
-- =============================================================================
