-- OST Critical Fix: rende telefono nullable su fornitori
-- Motivazione: un fornitore può essere creato senza telefono generale;
-- i contatti specifici (fornitore_contatti) vengono aggiunti in un secondo momento.
-- La constraint NOT NULL impediva la creazione di fornitori dall'UI.
-- Non distruttiva: i valori esistenti non vengono alterati.
ALTER TABLE fornitori ALTER COLUMN telefono DROP NOT NULL;
