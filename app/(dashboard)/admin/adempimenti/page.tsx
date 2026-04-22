import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import AdempimentiView from '@/components/Adempimenti/AdempimentiView'

export default async function AdempimentiAdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profilo } = await supabase
    .from('profili').select('ruolo').eq('id', user.id).single()
  if (!profilo || !['admin', 'manager', 'segretaria'].includes(profilo.ruolo)) {
    redirect('/staff/adempimenti')
  }

  const canEdit = ['admin', 'manager'].includes(profilo.ruolo)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <ShieldCheck size={22} className="text-gold" />
          Adempimenti normativi
        </h1>
        <p className="text-stone text-sm mt-1">
          Scadenzario completo degli obblighi ricorrenti dello studio.
          {canEdit ? ' Segna fatto quando completi un adempimento, così il sistema calcola la prossima scadenza.' : ' Segna fatto gli adempimenti che completi.'}
        </p>
      </div>

      <AdempimentiView canEdit={canEdit} />
    </div>
  )
}
