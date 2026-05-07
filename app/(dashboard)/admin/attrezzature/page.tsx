import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/Layout/PageHeader'
import AttrezzatureAdmin from '@/components/Attrezzature/AttrezzatureAdmin'
import { Attrezzatura } from '@/types'

export default async function AttrezzaturePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || profilo.ruolo !== 'admin') redirect('/staff')

  const { data: attrezzature } = await adminDb
    .from('attrezzature')
    .select('*, manutenzioni(id, data, tipo, eseguito_da, note, prossima_data, creato_da_nome, created_at)')
    .order('nome', { ascending: true })
    .order('created_at', { referencedTable: 'manutenzioni', ascending: false })

  return (
    <div>
      <PageHeader
        title="Attrezzature"
        subtitle="Registro attrezzature cliniche e storico manutenzioni"
        breadcrumb={{ label: 'Dashboard', href: '/admin' }}
      />
      <AttrezzatureAdmin attrezzature={(attrezzature ?? []) as Attrezzatura[]} />
    </div>
  )
}
