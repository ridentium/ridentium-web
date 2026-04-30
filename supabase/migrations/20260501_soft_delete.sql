-- Soft delete per tasks e ricorrenti
-- Dopo questa migrazione, il codice usa deleted_at IS NULL per filtrare i record attivi.
-- I DELETE diventano UPDATE SET deleted_at = NOW().

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_not_deleted
  ON tasks (deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE ricorrenti
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ricorrenti_not_deleted
  ON ricorrenti (deleted_at) WHERE deleted_at IS NULL;
