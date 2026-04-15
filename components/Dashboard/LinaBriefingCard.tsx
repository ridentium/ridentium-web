'use client'

import Link from 'next/link'
import { ArrowRight, Package, CheckSquare, RefreshCw, ShoppingCart } from 'lucide-react'

interface Props {
  briefing: string
  alertCount: number
  tasksCount: number
  riordiniCount: number
  ricorrentiCount: number
}

export default function LinaBriefingCard({ briefing, alertCount, tasksCount, riordiniCount, ricorrentiCount }: Props) {
  function openLina() {
    document.dispatchEvent(new CustomEvent('lina:open'))
  }

  return (
    <div
      className="card lg:col-span-2 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1A1714 0%, #1E1A16 100%)',
        borderColor: 'rgba(201,168,76,0.2)',
      }}
    >
      {/* Glow sottile in background */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,0.08), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="flex items-start gap-4 relative">
        {/* Avatar Lina statico */}
        <div
          style={{
            width: 52, height: 52,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 38%, #E8C566, #9A7220)',
            border: '2px solid rgba(201,168,76,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 20px rgba(201,168,76,0.2)',
          }}
        >
          <span style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: '1.3rem', fontWeight: 600, color: '#0D0D0B',
          }}>L</span>
        </div>

        {/* Contenuto */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gold/60 uppercase tracking-[0.2em] mb-2 font-medium">
            Lina · Briefing del giorno
          </p>
          <p className="text-cream text-sm leading-relaxed mb-4">
            {briefing}
          </p>

          {/* Azioni rapide contestuali */}
          <div className="flex flex-wrap gap-2">
            {alertCount > 0 && (
              <Link
                href="/admin/magazzino"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', background: 'rgba(239,68,68,0.06)' }}
              >
                <Package size={11} />
                {alertCount} sotto soglia
                <ArrowRight size={10} />
              </Link>
            )}
            {tasksCount > 0 && (
              <Link
                href="/admin/tasks"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(201,168,76,0.25)', color: 'rgba(201,168,76,0.8)', background: 'rgba(201,168,76,0.06)' }}
              >
                <CheckSquare size={11} />
                {tasksCount} task apert{tasksCount === 1 ? 'o' : 'i'}
                <ArrowRight size={10} />
              </Link>
            )}
            {riordiniCount > 0 && (
              <Link
                href="/admin/magazzino"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(201,168,76,0.25)', color: 'rgba(201,168,76,0.8)', background: 'rgba(201,168,76,0.06)' }}
              >
                <ShoppingCart size={11} />
                {riordiniCount} riordine{riordiniCount === 1 ? '' : 'i'}
                <ArrowRight size={10} />
              </Link>
            )}
            {ricorrentiCount > 0 && (
              <Link
                href="/admin/ricorrenti"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}
              >
                <RefreshCw size={11} />
                {ricorrentiCount} ricorrent{ricorrentiCount === 1 ? 'e' : 'i'}
                <ArrowRight size={10} />
              </Link>
            )}
            <button
              onClick={openLina}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C', background: 'rgba(201,168,76,0.08)' }}
            >
              Chiedi a Lina →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
