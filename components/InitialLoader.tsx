'use client'
import { useEffect, useState } from 'react'

/**
 * Splash screen animato al caricamento iniziale dell'app.
 * Scompare con un fade-out morbido dopo la hydration lato client.
 */
export default function InitialLoader() {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter')

  useEffect(() => {
    // Fase 1: fade-in (~300ms)
    const t1 = setTimeout(() => setPhase('visible'), 50)
    // Fase 2: dopo hydration, avvia fade-out
    const t2 = setTimeout(() => setPhase('exit'), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Dopo il fade-out rimuovi completamente
  if (phase === 'exit') return null

  const opacity = phase === 'enter' ? 0 : 1

  return (
    <>
      <style>{`
        @keyframes ri-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ri-pulse {
          0%, 100% { opacity: 0.3; transform: scaleX(0.6); }
          50% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes ri-dots {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        .ri-dot-1 { animation: ri-dots 1.4s ease-in-out 0s infinite; }
        .ri-dot-2 { animation: ri-dots 1.4s ease-in-out 0.2s infinite; }
        .ri-dot-3 { animation: ri-dots 1.4s ease-in-out 0.4s infinite; }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0D0D0B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '32px',
          opacity,
          transition: 'opacity 0.4s ease',
          pointerEvents: phase === 'exit' ? 'none' : 'all',
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            letterSpacing: '0.45em',
            color: '#E8DCC8',
            fontSize: '1.6rem',
            fontWeight: 300,
            margin: 0,
            lineHeight: 1,
          }}>
            RIDENTIUM
          </p>
          <p style={{
            fontFamily: '"Inter", system-ui, sans-serif',
            letterSpacing: '0.35em',
            color: 'rgba(201,168,76,0.7)',
            fontSize: '0.55rem',
            fontWeight: 400,
            margin: '10px 0 0 0',
            textTransform: 'uppercase',
          }}>
            Sistema Operativo
          </p>
        </div>

        {/* Divisore oro */}
        <div style={{
          width: '40px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
        }} />

        {/* Tre pallini animati */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`ri-dot-${i + 1}`}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#C9A84C',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
