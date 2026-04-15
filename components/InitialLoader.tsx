'use client'
import { useEffect, useState } from 'react'

/**
 * Mostra uno splash animato durante il primo caricamento dell'app.
 * Viene rimosso immediatamente dopo la hydration lato client.
 */
export default function InitialLoader() {
  const [visible, setVisible] = useState(true)
  useEffect(() => { setVisible(false) }, [])
  if (!visible) return null
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5"
      style={{ background: '#0D0D0B' }}
    >
      <p
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          letterSpacing: '0.4em',
          color: '#E8DCC8',
          fontSize: '1.25rem',
          fontWeight: 300,
        }}
      >
        RIDENTIUM
      </p>
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: '1.5px solid rgba(201,168,76,0.5)',
          borderTopColor: 'transparent',
          animation: 'ridentium-spin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes ridentium-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
