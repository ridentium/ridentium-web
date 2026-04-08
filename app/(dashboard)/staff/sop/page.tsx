import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/Layout/PageHeader'
import SOPViewer from '@/components/SOP/SOPViewer'

export default async function SOPStaffPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // La RLS filtra automaticamente in base al ruolo
  const { data: sops } = await supabase
    .from('sop')
    .select('id, titolo, categoria, contenuto, versione, updated_at')
    .order('categoria')
    .order('titolo')

  return (
    <div>
      <PageHeader title="Protocolli" subtitle="Standard operativi e procedure" />
      <SOPViewer sops={sops ?? []} />
    </div>
  )
}
