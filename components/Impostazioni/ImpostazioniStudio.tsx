'use client'

import { useEffect, useState } from 'react'
import { Save, Check, RefreshCw, Clock } from 'lucide-react'
import { GIORNI_LABEL, DEFAULT_IMPOSTAZIONI, type ImpostazioniStudio } from '@/types/impostazioni'

export default function ImpostazioniStudio() {
  const [imp, setImp]     = useState<ImpostazioniStudio>(DEFAULT_IMPOSTAZIONI)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/impostazioni', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setImp({
          giorni_apertura: d.giorni_apertura ?? DEFAULT_IMPOSTAZIONI.giorni_apertura,
          orario_apertura: d.orario_apertura ?? DEFAULT_IMPOSTAZIONI.orario_apertura,
          orario_chiusura: d.orario_chiusura ?? DEFAULT_IMPOSTAZIONI.orario_chiusura,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleGiorno(d: number) {
    setImp(prev => ({
      ...prev,
      giorni_apertura: prev.giorni_apertura.includes(d)
        ? prev.giorni_apertura.filter(g => g !== d)
        : [...prev.giorni_apertura, d].sort(),
    }))
    setSaved(false)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/impostazioni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giorni_apertura: imp.giorni_apertura,
          orario_apertura: imp.orario_apertura,
          orario_chiusura: imp.orario_chiusura,
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Errore nel salvataggio')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 py-10" style={{ color: 'rgba(210,198,182,0.5)' }}>
        <RefreshCw size={14} className="animate-spin" /> Caricamento…
      </div>
    )
  }

  const gg = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const nomeBreve = (iso: number) => gg[iso === 7 ? 0 : iso]

  return (
    <div className="space-y-6 max-w-lg">
      {/* Giorni apertura */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-medium text-cream">Giorni di apertura</h3>
          <p className="text-xs text-stone mt-1">
            Seleziona i giorni in cui lo studio è aperto. Il calendario mostrerà i giorni chiusi in grigio
            e segnalerà gli adempimenti che scadono in quei giorni.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7].map(d => {
            const aperto = imp.giorni_apertura.includes(d)
            return (
              <button
                key={d}
                onClick={() => toggleGiorno(d)}
                className="flex flex-col items-center gap-0.5 px-3 py-2.5 rounded border transition-all"
                style={{
                  background: aperto ? 'rgba(201,168,76,0.15)' : 'rgba(26,16,9,0.4)',
                  borderColor: aperto ? 'rgba(201,168,76,0.5)' : 'rgba(74,59,44,0.5)',
                  color: aperto ? '#C9A84C' : 'rgba(160,144,126,0.5)',
                  minWidth: 52,
                  minHeight: 52,
                }}
              >
                <span className="text-[10px] uppercase tracking-widest font-medium">
                  {nomeBreve(d)}
                </span>
                <span className="text-[11px]">{aperto ? '✓' : '—'}</span>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-stone/50">
          {imp.giorni_apertura.length === 0
            ? 'Nessun giorno selezionato'
            : `Aperto: ${imp.giorni_apertura.map(d => GIORNI_LABEL[d]).join(', ')}`
          }
        </p>
      </div>

      {/* Orari */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-sm font-medium text-cream flex items-center gap-2">
            <Clock size={15} className="text-gold/70" /> Orario di apertura
          </h3>
          <p className="text-xs text-stone mt-1">
            Mostrato nel riepilogo della pagina Adempimenti.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-stone/60">Apertura</label>
            <input
              type="time"
              value={imp.orario_apertura}
              onChange={e => { setImp(p => ({ ...p, orario_apertura: e.target.value })); setSaved(false) }}
              className="input text-sm"
              style={{ minWidth: 110 }}
            />
          </div>
          <span className="text-stone/40 mt-4">—</span>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-stone/60">Chiusura</label>
            <input
              type="time"
              value={imp.orario_chiusura}
              onChange={e => { setImp(p => ({ ...p, orario_chiusura: e.target.value })); setSaved(false) }}
              className="input text-sm"
              style={{ minWidth: 110 }}
            />
          </div>
        </div>
      </div>

      {/* Salva */}
      {error && (
        <p className="text-red-400 text-xs flex items-center gap-1.5">
          ⚠ {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 text-sm px-5 py-2.5 rounded border transition-all disabled:opacity-50"
        style={{
          background: saved ? 'rgba(74,222,128,0.15)' : 'rgba(201,168,76,0.15)',
          borderColor: saved ? 'rgba(74,222,128,0.5)' : 'rgba(201,168,76,0.4)',
          color: saved ? '#4ADE80' : '#C9A84C',
          minHeight: 44,
        }}
      >
        {saving ? (
          <><RefreshCw size={14} className="animate-spin" /> Salvataggio…</>
        ) : saved ? (
          <><Check size={14} /> Salvato</>
        ) : (
          <><Save size={14} /> Salva impostazioni</>
        )}
      </button>
    </div>
  )
}
