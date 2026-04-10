'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles, Users, Package, CheckSquare, RefreshCw,
  Bell, Rocket, BookOpen, ChevronRight, ChevronLeft, X
} from 'lucide-react'

interface Step {
  icon: React.ElementType
  titolo: string
  corpo: string
  cta?: { label: string; href: string }
}

const STEPS_ADMIN: Step[] = [
  {
    icon: Sparkles,
    titolo: 'Benvenuto in Ridentium',
    corpo: 'Questo pannello ti permette di gestire tutto ciò che serve alla tua clinica: scorte, task, staff e molto altro. Clicca "Avanti" per scoprire le sezioni principali.',
  },
  {
    icon: Users,
    titolo: 'Gestione Staff',
    corpo: "Nella sezione Staff puoi creare i profili del tuo team, assegnare ruoli (ASO, Segretaria, Manager) e gestire l'accesso di ogni collaboratore.",
    cta: { label: 'Vai allo Staff', href: '/admin/staff' },
  },
  {
    icon: Package,
    titolo: 'Magazzino',
    corpo: 'Monitora le scorte in tempo reale. Imposta soglie minime per ogni prodotto: riceverai un avviso non appena le quantità scendono sotto la soglia. Puoi anche gestire i fornitori e tenere traccia dei riordini.',
    cta: { label: 'Vai al Magazzino', href: '/admin/magazzino' },
  },
  {
    icon: CheckSquare,
    titolo: 'Task e Deleghe',
    corpo: 'Crea task, assegnali ai membri del team e monitora l'avanzamento. I task ad alta priorità vengono evidenziati nella dashboard. Ogni membro riceve una notifica push quando gli viene assegnato un task.',
    cta: { label: 'Vai ai Task', href: '/admin/tasks' },
  },
  {
    icon: RefreshCw,
    titolo: 'Azioni Ricorrenti',
    corpo: 'Le azioni ricorrenti sono checklist periodiche (giornaliere, settimanali o mensili) che ogni membro del team deve completare. Perfette per protocolli di pulizia, controlli di sicurezza e routine cliniche.',
    cta: { label: 'Gestisci Ricorrenti', href: '/admin/ricorrenti' },
  },
  {
    icon: Bell,
    titolo: 'Notifiche Push',
    corpo: 'Abilita le notifiche push dal tuo profilo per ricevere aggiornamenti in tempo reale su task, scorte e richieste di riordino — anche quando il pannello non è aperto.',
    cta: { label: 'Impostazioni Profilo', href: '/admin/profilo' },
  },
  {
    icon: Rocket,
    titolo: 'Tutto pronto!',
    corpo: 'Hai completato la presentazione. La dashboard è il tuo punto di controllo centrale: torna qui ogni volta che vuoi avere una panoramica rapida della clinica. Buon lavoro!',
  },
]

const STEPS_STAFF: Step[] = [
  {
    icon: Sparkles,
    titolo: 'Benvenuto in Ridentium',
    corpo: 'Questa è la tua area personale. Qui trovi tutto ciò che ti serve per lavorare ogni giorno: i tuoi task, i protocolli clinici e lo stato del magazzino.',
  },
  {
    icon: CheckSquare,
    titolo: 'I tuoi Task',
    corpo: 'Nella sezione "I miei task" trovi tutte le attività che ti sono state assegnate. Puoi aggiornarle, segnare quelle completate e vedere la scadenza di ognuna.',
    cta: { label: 'Vai ai Task', href: '/staff/tasks' },
  },
  {
    icon: BookOpen,
    titolo: 'Protocolli (SOP)',
    corpo: "I Protocolli raccolgono tutte le procedure operative della clinica. Consultali ogni volta che hai dubbi su come eseguire un'attività in modo corretto.",
    cta: { label: 'Vedi i Protocolli', href: '/staff/sop' },
  },
  {
    icon: Package,
    titolo: 'Magazzino',
    corpo: 'Puoi consultare le scorte in tempo reale. Se noti che un prodotto è in esaurimento, puoi inviare una richiesta di riordino direttamente dal magazzino.',
    cta: { label: 'Vai al Magazzino', href: '/staff/magazzino' },
  },
  {
    icon: RefreshCw,
    titolo: 'Azioni Ricorrenti',
    corpo: 'Le azioni ricorrenti sono le routine periodiche che devi completare: giornaliere, settimanali o mensili. Spuntale man mano che le esegui per tenere traccia del tuo lavoro.',
    cta: { label: 'Vedi le Ricorrenti', href: '/staff/ricorrenti' },
  },
  {
    icon: Rocket,
    titolo: 'Tutto pronto!',
    corpo: 'Hai visto le funzioni principali. La home è il tuo punto di partenza: ogni mattina troverai subito i tuoi task aperti e lo stato del magazzino. Buona giornata!',
  },
]

interface Props {
  userId: string
  isAdmin: boolean
}

export default function OnboardingWizard({ userId, isAdmin }: Props) {
  const steps = isAdmin ? STEPS_ADMIN : STEPS_STAFF
  const [step, setStep] = useState(0)
  const [completing, setCompleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1
  const progress = ((step + 1) / steps.length) * 100

  async function complete() {
    if (completing) return
    setCompleting(true)
    await supabase.from('profili').update({ onboarding_completato: true }).eq('id', userId)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-obsidian border border-obsidian-light rounded-xl shadow-2xl overflow-hidden">

        {/* Skip button */}
        <button
          onClick={complete}
          disabled={completing}
          className="absolute top-4 right-4 text-stone/50 hover:text-stone transition-colors p-1"
          aria-label="Salta introduzione"
        >
          <X size={16} />
        </button>

        {/* Progress bar */}
        <div className="h-0.5 bg-obsidian-light">
          <div
            className="h-full bg-gold transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-8 py-10">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
            <Icon size={22} className="text-gold" />
          </div>

          {/* Step counter */}
          <p className="text-[10px] uppercase tracking-[0.25em] text-stone/60 mb-2">
            Passo {step + 1} di {steps.length}
          </p>

          {/* Title */}
          <h2 className="font-serif text-2xl text-cream font-light mb-4 leading-snug">
            {current.titolo}
          </h2>

          {/* Body */}
          <p className="text-stone text-sm leading-relaxed mb-8">
            {current.corpo}
          </p>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mb-8">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-4 h-1.5 bg-gold'
                    : i < step
                    ? 'w-1.5 h-1.5 bg-gold/40'
                    : 'w-1.5 h-1.5 bg-obsidian-light'
                }`}
                aria-label={`Passo ${i + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="btn-ghost flex items-center gap-1.5 text-stone/60 hover:text-cream text-sm px-3 py-2"
              >
                <ChevronLeft size={14} />
                Indietro
              </button>
            )}

            <div className="flex-1" />

            {current.cta && (
              <a
                href={current.cta.href}
                className="text-xs text-gold hover:text-gold-light transition-colors underline underline-offset-2"
                onClick={complete}
              >
                {current.cta.label}
              </a>
            )}

            {isLast ? (
              <button
                onClick={complete}
                disabled={completing}
                className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
              >
                {completing ? 'Attendere…' : 'Inizia!'}
                {!completing && <Rocket size={14} />}
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
              >
                Avanti
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
