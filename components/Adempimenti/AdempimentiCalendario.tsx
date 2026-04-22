'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  Adempimento, calcolaStato,
  CATEGORIA_COLOR, CATEGORIA_LABEL, FREQUENZA_LABEL,
} from '@/types/adempimenti'
import { isGiornoApertura, GIORNI_BREVE } from '@/types/impostazioni'

interface Props {
  adempimenti: Adempimento[]
  giorniApertura: number[]
  onSegnaFatto?: (a: Adempimento) => void
}

export default function AdempimentiCalendario({ adempimenti, giorniApertura, onSegnaFatto }: Props) {
  const oggi = useMemo(() => new Date(), [])
  const [mese, setMese] = useState(() => new Date(oggi.getFullYear(), oggi.getMonth(), 1))
  const [giornoSel, setGiornoSel] = useState<string | null>(null)  // YYYY-MM-DD

  const adPerGiorno = useMemo(() => {
    const map = new Map<string, Adempimento[]>()
    adempimenti.forEach(a => {
      if (!a.prossima_scadenza) return
      const key = a.prossima_scadenza.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    })
    return map
  }, [adempimenti])

  const grid = useMemo(() => {
    const anno = mese.getFullYear()
    const m = mese.getMonth()
    const primo = new Date(anno, m, 1)
    const ultimo = new Date(anno, m + 1, 0)
    const primoISO = primo.getDay() === 0 ? 7 : primo.getDay()
    const celle: (Date | null)[] = Array(primoISO - 1).fill(null)
    for (let d = 1; d <= ultimo.getDate(); d++) celle.push(new Date(anno, m, d))
    while (celle.length % 7 !== 0) celle.push(null)
    return celle
  }, [mese])

  const oggiStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`
  const meseLabel = mese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const giornoPanelItems = useMemo(() => {
    if (!giornoSel) return []
    return [...(adPerGiorno.get(giornoSel) ?? [])].sort((a, b) => {
      const order = { scaduto: 0, in_scadenza: 1, ok: 2 }
      return order[calcolaStato(a)] - order[calcolaStato(b)]
    })
  }, [giornoSel, adPerGiorno])

  return (
    <div className="space-y-4">
      {/* Navigazione mese */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() - 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded border border-obsidian-light/40 text-stone hover:text-cream transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <h3 className="text-sm font-medium text-cream capitalize">{meseLabel}</h3>
        <button
          onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() + 1, 1))}
          className="w-9 h-9 flex items-center justify-center rounded border border-obsidian-light/40 text-stone hover:text-cream transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Intestazioni giorni */}
      <div className="grid grid-cols-7 gap-0.5">
        {[1, 2, 3, 4, 5, 6, 7].map(d => (
          <div
            key={d}
            className="py-1.5 text-center text-[10px] uppercase tracking-wider"
            style={{ color: giorniApertura.includes(d) ? 'rgba(160,144,126,0.7)' : 'rgba(160,144,126,0.3)' }}
          >
            {GIORNI_BREVE[d]}
          </div>
        ))}
      </div>

      {/* Griglia giorni */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((giorno, i) => {
          if (!giorno) return <div key={`empty-${i}`} />

          const key = dateKey(giorno)
          const aperto = isGiornoApertura(giorno, giorniApertura)
          const aList = adPerGiorno.get(key) ?? []
          const isOggi = key === oggiStr
          const isSel = giornoSel === key

          const hasScaduto = aList.some(a => calcolaStato(a) === 'scaduto')
          const hasInScad = aList.some(a => calcolaStato(a) === 'in_scadenza')
          const ringColor = hasScaduto ? '#F87171' : hasInScad ? '#FBBF24' : aList.length > 0 ? '#4ADE80' : null

          return (
            <button
              key={key}
              onClick={() => setGiornoSel(isSel ? null : key)}
              className="relative flex flex-col items-center justify-start pt-1.5 pb-2 rounded transition-all"
              style={{
                minHeight: 52,
                background: isSel
                  ? 'rgba(201,168,76,0.18)'
                  : isOggi
                  ? 'rgba(201,168,76,0.07)'
                  : 'transparent',
                border: isSel
                  ? '1px solid rgba(201,168,76,0.5)'
                  : isOggi
                  ? '1px solid rgba(201,168,76,0.2)'
                  : ringColor
                  ? `1px solid ${ringColor}25`
                  : '1px solid transparent',
                opacity: aperto ? 1 : 0.4,
              }}
            >
              <span
                className="text-xs leading-none"
                style={{ color: isOggi ? '#C9A84C' : '#D2C6B6', fontWeight: isOggi ? 700 : 400 }}
              >
                {giorno.getDate()}
              </span>
              {!aperto && aList.length > 0 && (
                <span className="text-[9px] text-amber-400/60 mt-0.5">⚠</span>
              )}
              {aList.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-0.5 max-w-full">
                  {aList.slice(0, 4).map(a => (
                    <div
                      key={a.id}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: CATEGORIA_COLOR[a.categoria] }}
                    />
                  ))}
                  {aList.length > 4 && (
                    <span className="text-[8px] leading-none" style={{ color: 'rgba(210,198,182,0.4)' }}>
                      +{aList.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legenda */}
      <div
        className="flex gap-4 flex-wrap text-[10px] pt-2 border-t border-obsidian-light/20"
        style={{ color: 'rgba(160,144,126,0.5)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400/80 flex-shrink-0" /> Scaduto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400/80 flex-shrink-0" /> In scadenza
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400/80 flex-shrink-0" /> OK
        </span>
        <span>· Giorni chiusi in grigio</span>
      </div>

      {/* Panel giorno selezionato */}
      {giornoSel && (
        <div className="card" style={{ borderColor: 'rgba(201,168,76,0.3)', borderWidth: 1 }}>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium text-cream capitalize">
                {new Date(giornoSel + 'T12:00:00').toLocaleDateString('it-IT', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </h4>
              {!isGiornoApertura(new Date(giornoSel + 'T12:00:00'), giorniApertura) && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ color: '#FBBF24', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.07)' }}
                >
                  Studio chiuso
                </span>
              )}
            </div>
            <button
              onClick={() => setGiornoSel(null)}
              className="flex items-center justify-center text-stone/50 hover:text-cream transition-colors flex-shrink-0"
              style={{ minWidth: 32, minHeight: 32 }}
            >
              <X size={14} />
            </button>
          </div>

          {giornoPanelItems.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(210,198,182,0.4)' }}>
              Nessun adempimento in scadenza questo giorno.
            </p>
          ) : (
            <div className="space-y-0 divide-y divide-obsidian-light/20">
              {giornoPanelItems.map(a => {
                const stato = calcolaStato(a)
                const stCol = stato === 'scaduto' ? '#F87171' : stato === 'in_scadenza' ? '#FBBF24' : '#4ADE80'
                return (
                  <div key={a.id} className="flex items-center gap-2.5 py-2.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: CATEGORIA_COLOR[a.categoria] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-cream truncate">{a.titolo}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(160,144,126,0.6)' }}>
                        {CATEGORIA_LABEL[a.categoria]} · {FREQUENZA_LABEL[a.frequenza]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-medium" style={{ color: stCol }}>
                        {stato === 'scaduto' ? 'Scaduto' : stato === 'in_scadenza' ? 'In scadenza' : 'OK'}
                      </span>
                      {onSegnaFatto && (
                        <button
                          onClick={() => onSegnaFatto(a)}
                          className="text-[10px] px-2 py-1 rounded border transition-colors"
                          style={{
                            background: 'rgba(74,222,128,0.1)',
                            borderColor: 'rgba(74,222,128,0.35)',
                            color: '#4ADE80',
                            minHeight: 28,
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
          )}
        </div>
      )}
    </div>
  )
}
