'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Package, CheckSquare, RefreshCw, ShoppingCart, Loader2 } from 'lucide-react'

interface Props {
  briefingFallback: string   // testo deterministico generato server-side (istantaneo)
  firstName: string
  alertCount: number
  tasksCount: number
  riordiniCount: number
  ricorrentiCount: number
}

export default function LinaBriefingCard({
  briefingFallback, firstName, alertCount, tasksCount, riordiniCount, ricorrentiCount,
}: Props) {
  const [briefing, setBriefing] = useState(briefingFallback)
  const [loading, setLoading] = useState(false)

  // Genera briefing con Lina ad ogni mount — nessuna cache così riflette
  // sempre la situazione corrente (se cambiano task/scorte, aggiorna subito)
  useEffect(() => {
    setLoading(true)
    const ctx = [
      alertCount > 0    ? `${alertCount} prodott${alertCount === 1 ? 'o' : 'i'} sotto soglia` : 'magazzino in ordine',
      tasksCount > 0    ? `${tasksCount} task apert${tasksCount === 1 ? 'o' : 'i'}` : null,
      riordiniCount > 0 ? `${riordiniCount} riordine${riordiniCount === 1 ? '' : 'i'} da evadere` : null,
      ricorrentiCount > 0 ? `${ricorrentiCount} azion${ricorrentiCount === 1 ? 'e' : 'i'} ricorrenti in sospeso` : null,
    ].filter(Boolean).join(', ')

    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: `Briefing del giorno per ${firstName}. Situazione attuale: ${ctx}. Scrivi UNA frase di massimo 25 parole, tono caldo e diretto come una brava segretaria. Nessun prefisso, nessun elenco.`,
        }],
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.risposta && d.risposta.length < 200) {
          const text = d.risposta.trim()
          setBriefing(text)
          // Nessuna cache — ogni mount genera un briefing fresco
        }
      })
      .catch(() => { /* fallback statico rimane */ })
      .finally(() => setLoading(false))
  }, [])

  function openLina() {
    document.dispatchEvent(new CustomEvent('lina:open'))
  }

  return (
    <div
      className="card lg:col-span-2 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FDF7EE 0%, #F8F0E0 100%)',
        borderColor: 'rgba(201,168,76,0.3)',
      }}
    >
      {/* Glow */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,0.15), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="flex items-start gap-4 relative">
        {/* Avatar Lina */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 38%, #E8C566, #9A7220)',
          border: '2px solid rgba(201,168,76,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 0 20px rgba(201,168,76,0.2)',
        }}>
          <span style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '1.3rem', fontWeight: 600, color: '#0D0D0B' }}>
            L
          </span>
        </div>

        {/* Testo */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] mb-2 font-medium" style={{ color: 'rgba(160,120,40,0.8)' }}>
            Lina · Briefing del giorno
          </p>

          <div className="min-h-[2.5rem] flex items-center gap-2">
            {loading && <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: '#C9A84C' }} />}
            <p className={`text-sm leading-relaxed transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`} style={{ color: '#1A1714' }}>
              {briefing}
            </p>
          </div>

          {/* Chip azioni contestuali */}
          <div className="flex flex-wrap gap-2 mt-4">
            {alertCount > 0 && (
              <Link href="/admin/magazzino"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', background: 'rgba(239,68,68,0.06)' }}>
                <Package size={11} />
                {alertCount} sotto soglia
                <ArrowRight size={10} />
              </Link>
            )}
            {tasksCount > 0 && (
              <Link href="/admin/tasks"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(201,168,76,0.25)', color: 'rgba(201,168,76,0.8)', background: 'rgba(201,168,76,0.06)' }}>
                <CheckSquare size={11} />
                {tasksCount} task
                <ArrowRight size={10} />
              </Link>
            )}
            {riordiniCount > 0 && (
              <Link href="/admin/magazzino"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(201,168,76,0.25)', color: 'rgba(201,168,76,0.8)', background: 'rgba(201,168,76,0.06)' }}>
                <ShoppingCart size={11} />
                {riordiniCount} riordini
                <ArrowRight size={10} />
              </Link>
            )}
            {ricorrentiCount > 0 && (
              <Link href="/admin/ricorrenti"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)' }}>
                <RefreshCw size={11} />
                {ricorrentiCount} ricorrenti
                <ArrowRight size={10} />
              </Link>
            )}
            <button
              onClick={openLina}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C', background: 'rgba(201,168,76,0.08)' }}>
              Chiedi a Lina →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
