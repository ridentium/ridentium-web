import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import AdempimentiView from '@/components/Adempimenti/AdempimentiView'

export default async function AdempimentiStaffPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <ShieldCheck size={22} className="text-gold" />
          Adempimenti
        </h1>
        <p className="text-stone text-sm mt-1">
          Gli adempimenti dello studio. Segna fatto quando ne completi uno.
        </p>
      </div>

      <AdempimentiView canEdit={false} />
    </div>
  )
}
