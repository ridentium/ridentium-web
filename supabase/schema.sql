-- ============================================================
-- RIDENTIUM — Schema Database Supabase
-- Esegui questo SQL nel SQL Editor del tuo progetto Supabase
-- ============================================================

-- Abilita RLS (Row Level Security) globalmente
-- e usa i ruoli per filtrare i dati

-- ============================================================
-- TABELLA: profili (estende auth.users di Supabase)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profili (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  nome        TEXT NOT NULL,
  cognome     TEXT NOT NULL,
  ruolo       TEXT NOT NULL DEFAULT 'aso'
                CHECK (ruolo IN ('admin', 'aso', 'segretaria', 'manager')),
  avatar_url  TEXT,
  attivo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profili ENABLE ROW LEVEL SECURITY;

-- Ogni utente vede il proprio profilo; admin vede tutti
CREATE POLICY "profili_select" ON public.profili
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

CREATE POLICY "profili_update_self" ON public.profili
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profili_admin_all" ON public.profili
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

-- Trigger: crea profilo automaticamente al signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profili (id, email, nome, cognome, ruolo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'cognome', ''),
    COALESCE(NEW.raw_user_meta_data->>'ruolo', 'aso')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- TABELLA: magazzino
-- ============================================================
CREATE TABLE IF NOT EXISTS public.magazzino (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prodotto          TEXT NOT NULL,
  categoria         TEXT NOT NULL
    CHECK (categoria IN (
      'Impianti','Componentistica Protesica','Materiali Chirurgici',
      'Consumabili','Compositi & Cementi','Endodonzia',
      'Igiene & Profilassi','Ortodonzia','DPI & Sterilizzazione','Radiologia'
    )),
  azienda           TEXT,
  codice_articolo   TEXT,
  quantita          NUMERIC DEFAULT 0,
  soglia_minima     NUMERIC DEFAULT 0,
  unita             TEXT DEFAULT 'pz'
    CHECK (unita IN ('pz','conf','ml','rotoli','kit','scatole')),
  diametro          NUMERIC,
  lunghezza         NUMERIC,
  prezzo_unitario   NUMERIC,
  lotto             TEXT,
  scadenza          DATE,
  ultimo_riordino   DATE,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.magazzino ENABLE ROW LEVEL SECURITY;

-- Tutto lo staff autenticato può leggere
CREATE POLICY "magazzino_select_auth" ON public.magazzino
  FOR SELECT TO authenticated USING (TRUE);

-- Solo admin può inserire/modificare/eliminare
CREATE POLICY "magazzino_write_admin" ON public.magazzino
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

-- ============================================================
-- TABELLA: riordini (richieste di riordino dallo staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.riordini (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  magazzino_id      UUID REFERENCES public.magazzino(id) ON DELETE CASCADE,
  richiesto_da      UUID REFERENCES public.profili(id),
  note              TEXT,
  stato             TEXT DEFAULT 'aperta'
    CHECK (stato IN ('aperta','evasa','annullata')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.riordini ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riordini_select_auth" ON public.riordini
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "riordini_insert_auth" ON public.riordini
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = richiesto_da);

CREATE POLICY "riordini_update_admin" ON public.riordini
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

-- ============================================================
-- TABELLA: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo        TEXT NOT NULL,
  descrizione   TEXT,
  assegnato_a   UUID REFERENCES public.profili(id),
  creato_da     UUID REFERENCES public.profili(id),
  stato         TEXT DEFAULT 'da_fare'
    CHECK (stato IN ('da_fare','in_corso','completato')),
  priorita      TEXT DEFAULT 'media'
    CHECK (priorita IN ('bassa','media','alta')),
  scadenza      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Admin vede tutto; staff vede solo i propri task
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    assegnato_a = auth.uid()
    OR creato_da = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creato_da);

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    assegnato_a = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

CREATE POLICY "tasks_delete_admin" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

-- ============================================================
-- TABELLA: sop (Standard Operating Procedures)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sop (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo          TEXT NOT NULL,
  categoria       TEXT NOT NULL,
  contenuto       TEXT NOT NULL,
  versione        TEXT DEFAULT '1.0',
  autore          UUID REFERENCES public.profili(id),
  ruoli_visibili  TEXT[] DEFAULT ARRAY['admin','aso','segretaria','manager'],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_select" ON public.sop
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid()
      AND p.ruolo = ANY(sop.ruoli_visibili)
    )
  );

CREATE POLICY "sop_write_admin" ON public.sop
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profili p
      WHERE p.id = auth.uid() AND p.ruolo = 'admin'
    )
  );

-- ============================================================
-- TRIGGER: updated_at automatico
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER set_updated_at_magazzino
  BEFORE UPDATE ON public.magazzino
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_sop
  BEFORE UPDATE ON public.sop
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- DATI INIZIALI: Mariano come admin
-- (esegui DOPO aver creato il tuo account da Supabase Auth)
-- Sostituisci 'TUO-UUID' con il tuo user ID da Auth > Users
-- ============================================================
-- UPDATE public.profili
-- SET ruolo = 'admin', nome = 'Mariano', cognome = 'Di Paola'
-- WHERE id = 'TUO-UUID';
