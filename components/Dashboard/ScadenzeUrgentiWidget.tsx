'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Clock, CheckCircle2, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from '@/types/adempimenti'
import type { CategoriaAdempimento, StatoAdempimento } from '@/types/adempimenti'

interface AdempimentoUrgente {
  id: string
  titolo: string
  categoria: CategoriaAdempimento
  frequenza: string
  prossima_scadenza: string | null
  evidenza_richiesta: string | null
  _stato: StatoAdempimento
  _gg: number // giorni alla scadenza (negativo = scaduto)
}

interface Props {
  adempimenti: AdempimentoUrgente[]
}

export default function ScadenzeUrgentiWidget({ adempimenti }: Props) {
  const [completando, setCompletando] = useState<string | null>(null)
  const [completati, setCompletati] = useState<Set<string>>(new Set())
  const [espanso, setEspanso] = useState(true)

  const visibili = adempimenti.filter(a => !completati.has(a.id))

  async function segnaDiretto(a: AdempimentoUrgente) {
    // Se richiede evidenza → vai alla sezione adempimenti
    if (a.evidenza_richiesta) return

    setCompletando(a.id)
    try {
      const r = await fetch(`/api/adempimenti/${a.id}/completa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: null, evidenza_descrizione: null }),
      })
      if (r.ok) {
        setCompletati(prev => new Set([...Array.from(prev), a.id]))
      }
    } finally {
      setCompletando(null)
    }
  }

  if (adempimenti.length === 0) return null

  const scadutiCount  = adempimenti.filter(a => a._stato === 'scaduto').length
  const inScadenzaCount = adempimenti.filter(a => a._stato === 'in_scadenza').length

  return (
    <div className="card lg:col-span-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-cream uppercase tracking-widest">
            Adempimenti urgenti
          </h3>
          <div className="flex items-center gap-2">
            {scadutiCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {scadutiCount} scadutt{scadutiCount === 1 ? 'o' : 'i'}
              </span>
            )}
            {inScadenzaCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                {inScadenzaCount} in scadenza
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/adempimenti" className="text-xs text-gold hover:text-gold-light transition-colors">
            Tutti →
          </Link>
          <button onClick={() => setEspanso(v => !v)} className="text-stone/40 hover:text-stone transition-colors">
            {espanso ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {espanso && (
        visibili.length === 0 ? (
          <p className="text-stone text-sm py-4 text-center">✓ Tutti gestiti</p>
        ) : (
          <div className="space-y-2">
            {visibili.map(a => {
              const isScaduto = a._stato === 'scaduto'
              const catColor = CATEGORIA_COLOR[a.categoria] ?? '#A0907E'
              const needsEvidenza = !!a.evidenza_richiesta

              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg border"
                  style={{
                    borderColor: isScaduto ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.2)',
                    background: isScaduto ? 'rgba(248,113,113,0.04)' : 'rgba(251,191,36,0.03)',
                  }}
                >
                  {/* Stato icon */}
                  <div className="flex-shrink-0">
                    {isScaduto
                      ? <AlertCircle size={16} style={{ color: '#F87171' }} />
                      : <Clock size={16} style={{ color: '#FBBF24' }} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-cream truncate">{a.titolo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ color: catColor, background: catColor + '18', border: `1px solid ${catColor}40` }}>
                        {CATEGORIA_LABEL[a.categoria] ?? a.categoria}
                      </span>
                      <span className="text-[10px]" style={{ color: isScaduto ? '#F87171' : '#FBBF24' }}>
                        {isScaduto
                          ? `Scaduto da ${Math.abs(a._gg)} giorni`
                          : a._gg === 0 ? 'Scade oggi'
                          : a._gg === 1 ? 'Scade domani'
                          : `Scade fra ${a._gg} giorni`}
                      </span>
                      {needsEvidenza && (
                        <span className="text-[10px] flex items-center gap-0.5 text-stone/50">
                          <FileText size={9} /> richiede evidenza
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Azione */}
                  {needsEvidenza ? (
                    <Link
                      href="/admin/adempimenti"
                      className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap"
                      style={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C', background: 'rgba(201,168,76,0.08)' }}
                    >
                      Apri →
                    </Link>
                  ) : (
                    <button
                      onClick={() => segnaDiretto(a)}
                      disabled={completando === a.id}
                      className="flex-shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border transition-colors disabled:opacity-50 whitespace-nowrap"
                      style={{ borderColor: 'rgba(74,222,128,0.4)', color: '#4ADE80', background: 'rgba(74,222,128,0.08)' }}
                    >
                      {completando === a.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <CheckCircle2 size={11} />}
                      Segna fatto
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
