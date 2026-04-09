# Configurazione VAPID per Push Notifications

## Chiavi generate (da aggiungere alle variabili d'ambiente)

### Vercel Dashboard → Settings → Environment Variables

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEtUg5t6wmK6HQjMkW5gXgGCST_lPgaxHJoNe3-YgccY7dmWm_F71G41TWmE_CunL2hZsDDIyozVmqJbenqVWnk

VAPID_PRIVATE_KEY=8OfHJRHIUizOvIPFlD8MDub6qFwZRCXQRcgvyrS1hgs

NOTIFY_SECRET=ridentium-notify-2025
```

## Migrazione Database Supabase

Esegui questo SQL nel Supabase SQL Editor:

```sql
-- Tabella per le sottoscrizioni push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ruolo text NOT NULL DEFAULT 'staff',
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own subscriptions"
  ON push_subscriptions FOR ALL
  USING (]]th.uid() = user_id);

CREATE POLICY "Admins read all subscriptions"
  ON push_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profili
      WHERE profili.id = auth.uid()
      AND profili.ruolo = 'admin'
    )
  );

-- Tabella per la configurazione notifiche
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL UNIQUE,
  abilitata boolean DEFAULT true,
  ruoli_destinatari text[] DEFAULT ARRAY['admin'],
  updated_at timestamptz DEFAULT now()
);

-- Valori di default
INSERT INTO notification_settings (tipo, abilitata, ruoli_destinatari) VALUES
  ('stock_minimo',      true, ARRAY['admin']),
  ('task_assegnata',    true, ARRAY['admin', 'staff']),
  ('ricorrente_scaduta',true, ARRAY['admin'])
ON CONFLICT (tipo) DO NOTHING;

-- Policy: solo admin può leggere/modificare
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification settings"
  ON notification_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profili
      WHERE profili.id = auth.uid()
      AND profili.ruolo = 'admin'
    )
  );
```
