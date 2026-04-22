'use client'

import { useMemo } from 'react'
import {
  Adempimento, calcolaStato,
  CATEGORIA_COLOR, CATEGORIA_LABEL, FREQUENZA_LABEL, scadenzaLabel,
} from '@/types/adempimenti'
import { isGiornoApertura } from '@/types/impostazioni'

interface Props {
  adempimenti: Adempimento[]
  giorniApertura: number[]
  onSegnaFatto?: (a: Adempimento) => void
}

export default function AdempimentiTimeline({ adempimenti, giorniApertura, onSegnaFatto }: Props) {
  const oggi = useMemo(() => new Date(), [])

  const mesi = useMemo(() => {
    // Bucket: mese corrente + 11 successivi (12 totali)
    const map = new Map<string, { key: string; label: string; date: Date; items: Adempimento[] }>()
    for (let i = 0; i < 12; i++) {
      const d = new Date(oggi.getFullYear(), oggi.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, {
        key,
        label: d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
        date: d,
        items: [],
      })
    }

    adempimenti.forEach(a => {
      if (!a.prossima_scadenza) return
      const d = new Date(a.prossima_scadenza)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (map.has(key)) map.get(key)!.items.push(a)
    })

    // Tieni solo mesi con adempimenti, più il mese corrente sempre visibile
    const oggiKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
    return Array.from(map.values()).filter(m => m.items.length > 0 || m.key === oggiKey)
  }, [adempimenti, oggi])

  return (
    <div className="space-y-8">
      {mesi.map(({ key, label, date, items }) => {
        const isCurrentMonth = key === `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
        const sorted = [...items].sort((a, b) => {
          const order = { scaduto: 0, in_scadenza: 1, ok: 2 }
          const sd = order[calcolaStato(a)] - order[calcolaStato(b)]
          if (sd !== 0) return sd
          const aT = a.prossima_scadenza ? new Date(a.prossima_scadenza).getTime() : 0
          const bT = b.prossima_scadenza ? new Date(b.prossima_scadenza).getTime() : 0
          return aT - bT
        })

        const nScaduti = sorted.filter(a => calcolaStato(a) === 'scaduto').length
        const nInScad = sorted.filter(a => calcolaStato(a) === 'in_scadenza').length
        const dotColor = nScaduti > 0 ? '#F87171' : nInScad > 0 ? '#FBBF24' : '#4ADE80'

        return (
          <div key={key}>
            {/* Header mese */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: items.length === 0 ? 'rgba(160,144,126,0.25)' : dotColor }}
              />
              <span
                className="text-[11px] font-medium uppercase tracking-widest capitalize flex-shrink-0"
                style={{ color: isCurrentMonth ? '#C9A84C' : 'rgba(210,198,182,0.65)' }}
              >
                {label}
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                {nScaduti > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}
                  >
                    {nScaduti} scadut{nScaduti === 1 ? 'o' : 'i'}
                  </span>
                )}
                {nInScad > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}
                  >
                    {nInScad} in scadenza
                  </span>
                )}
                {items.length > 0 && nScaduti === 0 && nInScad === 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,222,128,0.12)', color: '#4ADE80' }}
                  >
                    {items.length} ok
                  </span>
                )}
              </div>
              <div className="flex-1 border-t border-obsidian-light/20" />
            </div>

            {/* Adempimenti del mese */}
            {sorted.length === 0 ? (
              <p className="pl-5 text-xs" style={{ color: 'rgba(160,144,126,0.4)' }}>
                Nessun adempimento in scadenza questo mese.
              </p>
            ) : (
              <div className="pl-5 relative">
                {/* Linea verticale */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-px"
                  style={{ background: 'rgba(74,59,44,0.5)', left: '3px' }}
                />
                <div className="space-y-0 divide-y divide-obsidian-light/15">
                  {sorted.map(a => {
                    const stato = calcolaStato(a)
                    const stCol = stato === 'scaduto' ? '#F87171' : stato === 'in_scadenza' ? '#FBBF24' : 'rgba(74,222,128,0.7)'
                    const scadDate = a.prossima_scadenza ? new Date(a.prossima_scadenza) : null
                    const chiuso = scadDate && !isGiornoApertura(scadDate, giorniApertura)

                    return (
                      <div key={a.id} className="flex items-center gap-3 py-2.5 relative pl-4">
                        {/* Dot sulla linea */}
                        <div
                          className="absolute left-0 w-2 h-2 rounded-full flex-shrink-0 border"
                          style={{
                            background: CATEGORIA_COLOR[a.categoria],
                            borderColor: '#1A1009',
                            left: '-1px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                          }}
                        />

                        {/* Data */}
                        {scadDate && (
                          <div className="flex-shrink-0 text-center w-10">
                            <div className="text-[13px] font-semibold leading-none text-cream">
                              {String(scadDate.getDate()).padStart(2, '0')}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(160,144,126,0.5)' }}>
                              {scadDate.toLocaleDateString('it-IT', { weekday: 'short' })}
                            </div>
                          </div>
                        )}

                        {/* Contenuto */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-cream leading-snug">{a.titolo}</span>
                            {chiuso && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0"
                                style={{ color: '#FBBF24', borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)' }}
                              >
                                ⚠ studio chiuso
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className="text-[10px]"
                              style={{ color: CATEGORIA_COLOR[a.categoria] + 'BB' }}
                            >
                              {CATEGORIA_LABEL[a.categoria]}
                            </span>
                            <span className="text-[10px]" style={{ color: 'rgba(160,144,126,0.35)' }}>·</span>
                            <span className="text-[10px]" style={{ color: 'rgba(160,144,126,0.5)' }}>
                              {FREQUENZA_LABEL[a.frequenza]}
                            </span>
                          </div>
                        </div>

                        {/* Stato + azione */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] font-medium hidden sm:block" style={{ color: stCol }}>
                            {scadenzaLabel(a)}
                          </span>
                          {onSegnaFatto && (
                            <button
                              onClick={() => onSegnaFatto(a)}
                              className="text-[10px] px-2 py-1.5 rounded border transition-colors"
                              style={{
                                background: 'rgba(74,222,128,0.1)',
                                borderColor: 'rgba(74,222,128,0.35)',
                                color: '#4ADE80',
                                minHeight: 32,
                              }}
                            >
                              Segna fatto
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
