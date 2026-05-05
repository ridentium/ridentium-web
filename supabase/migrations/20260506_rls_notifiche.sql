-- =============================================================================
-- Migrazione: restringe la policy INSERT su notifiche
-- Problema: WITH CHECK (TRUE) permetteva a qualsiasi utente autenticato di
--   inserire notifiche per altri utenti (user_id arbitrario).
-- Fix: solo un utente può inserire notifiche per sé stesso.
--   Le insert server-side (adminDb / service_role) bypassano RLS in ogni caso
--   e continuano a funzionare senza modifiche.
-- =============================================================================

-- 1. Elimina la policy permissiva esistente
DROP POLICY IF EXISTS "service_insert" ON public.notifiche;

-- 2. Crea policy corretta: authenticated può inserire solo notifiche proprie
--    (service_role bypassa RLS e può ancora inserire per qualsiasi user_id)
CREATE POLICY "own_insert" ON public.notifiche
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
