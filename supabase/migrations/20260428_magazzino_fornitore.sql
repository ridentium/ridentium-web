-- Migration: aggiunge fornitore_id alla tabella magazzino
-- Permette di associare ogni prodotto al fornitore predefinito per il riordino automatico

ALTER TABLE public.magazzino
  ADD COLUMN IF NOT EXISTS fornitore_id UUID
    REFERENCES public.fornitori(id)
    ON DELETE SET NULL;

-- Indice per join veloci fornitore → prodotti sotto soglia
CREATE INDEX IF NOT EXISTS idx_magazzino_fornitore_id ON public.magazzino(fornitore_id);

COMMENT ON COLUMN public.magazzino.fornitore_id IS 'Fornitore predefinito per il riordino di questo prodotto';
