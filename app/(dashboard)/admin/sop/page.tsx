import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import SOPAdmin from '@/components/SOP/SOPAdmin'

export default async function SOPPage() {
  const supabase = createClient()
  const { data: sops } = await supabase
    .from('sop')
    .select('*, autore_profilo:profili!sop_autore_fkey(nome, cognome)')
    .order('categoria')
    .order('titolo')

  return (
    <div>
      <PageHeader title="SOP & Protocolli" subtitle="Standard Operating Procedures" />
      <SOPAdmin sops={sops ?? []} />
    </div>
  )
}
