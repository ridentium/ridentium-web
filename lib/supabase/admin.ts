import { createClient } from '@supabase/supabase-js'

// Client con service role key -- bypassa RLS.
// Usare SOLO in Server Components / Route Handlers, mai nel client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
