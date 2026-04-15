import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/Layout/PageHeader'
import AiChatPage from '@/components/AI/AiChatPage'

export default async function AIPage() {
  const supabase = createClient()
  const adminDb = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profilo }, { data: sessioni }] = await Promise.all([
    adminDb.from('profili').select('nome, cognome, ruolo').eq('id', user!.id).single(),
    adminDb.from('ai_sessioni')
      .select('id, titolo, created_at, updated_at')
      .eq('utente_id', user!.id)
      .order('updated_at', { ascending: false })
      .limit(20),
  ])

  const userName = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim()
  const userRole = profilo?.ruolo ?? 'aso'

  return (
    <div className="h-[calc(100vh-theme(spacing.24))] flex flex-col">
      <PageHeader
        title="RIDA — Assistente AI"
        subtitle="Chiedi qualsiasi cosa sul gestionale. Crea task, consulta scorte, gestisci riordini."
      />
      <AiChatPage
        userName={userName}
        userRole={userRole}
        userId={user!.id}
        storico={sessioni ?? []}
      />
    </div>
  )
}
