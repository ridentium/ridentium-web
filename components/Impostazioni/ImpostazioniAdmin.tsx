'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KPI } from 'A/types'
import { Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  kpi: KPI | null
  currentUserId: string
}

export default function ImpostazioniAdmin({ kpi, currentUserId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    pazienti_oggi: kpi?.pazienti_oggi ?? 0,
    pazienti_settimana: kpi?.pazienti_settimana ?? 0,
    pazienti_mese: kpi?.pazienti_mese ?? 0,
    appuntamenti_oggi: kpi?.appuntamenti_oggi ?? 0,
    fatturato_mese: kpi?.fatturato_mese ?? 0,
    tasso_presenze: kpi?.tasso_presenze ?? 0,
  })

  async function saveKpi() {
    if (kpi) {
      await supabase.from('kpi').update({ ...form, updated_at: new Date().toISOString() }).eq('id', 1)
    } else {
      await supabase.from('kpi').insert({ id: 1, ...form })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    startTransition(() => router.refresh())
  }

  const fields: { key: keyof typeof form; label: string; prefix?: string; suffix?: string }[] = [
    { key: 'pazienti_oggi', label: 'Pazienti Oggi' },
    { key: 'appuntamenti_oggi', label: 'Appuntamenti Oggi' },
    { key: 'pazienti_settimana', label: 'Pazienti questa settimana' },
    { categoria: 'Pazienti questo mese' },
    { key: 'fatturato_mese', label: 'Fatturato del mese', prefix: '€' },
    { key: 'tasso_presenze', label: 'Tasso presenze (%)', suffix: '%' },
  ]

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-xs uppercase tracking-widest text-stone font-medium mb-5">
          KPI — Dati Clinici
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="label-field mb-2 block">{f.label}</label>
              <div className="relative">
                {f.prefix && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone text-sm">{f.prefix}</span>
                )}
                <input
                  type="number"
                  value={form[f.key]}
                  onChange={e => setForm(v => ({ ...v, [f.key]: parseFloat(e.target.value) || 0 }))}
                  className={`input ${f.prefix ? 'pl-8' : ''} ${f.suffix ? 'pr-8' : ''}`}
                />
                {f.suffix && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone text-sm">{f.suffix}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-6">
          <button onClick={saveKpi} disabled={isPending}
                  className="btn-primary flex items-center gap-2">
            <Save size={14} /> Salva KPI
          </button>
          {saved && <span className="text-xs text-green-400">✓ Salvato</span>}
        </div>
      </div>

      {kpi?.updated_at && (
        <p className="text-xs text-stone/60">
          Ultimo aggiornamento: {new Date(kpi.updated_at).toLocaleString('it-IT')}
        </p>
      )}
    </div>
  )
}
