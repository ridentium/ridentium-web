import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RIDENTIUM — Sistema Operativo',
  description: 'Pannello di gestione interno RIDENTIUM',
  robots: 'noindex, nofollow',
}

// Stili e keyframes per lo splash — iniettati direttamente nell'HTML
const SPLASH_STYLES = `
  #ri-splash {
    position: fixed; inset: 0; z-index: 9999;
    background: #0D0D0B;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 32px;
    transition: opacity 0.5s ease;
  }
  @keyframes ri-dot {
    0%, 80%, 100% { opacity: 0.15; transform: scale(0.7); }
    40%            { opacity: 1;    transform: scale(1);   }
  }
  #ri-d1 { animation: ri-dot 1.4s ease-in-out 0s   infinite; }
  #ri-d2 { animation: ri-dot 1.4s ease-in-out 0.2s infinite; }
  #ri-d3 { animation: ri-dot 1.4s ease-in-out 0.4s infinite; }
`

// Script inline: rimuove lo splash appena il DOM è pronto
const SPLASH_SCRIPT = `
  (function() {
    function hideSplash() {
      var el = document.getElementById('ri-splash');
      if (!el) return;
      el.style.opacity = '0';
      setTimeout(function() { el.remove(); }, 500);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(hideSplash, 200);
      });
    } else {
      setTimeout(hideSplash, 200);
    }
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* Stili dello splash iniettati subito nell'<head> */}
        <style dangerouslySetInnerHTML={{ __html: SPLASH_STYLES }} />
      </head>
      <body className="bg-obsidian text-cream antialiased">

        {/* ── Splash screen ─────────────────────────────────────────────────
            Viene renderizzato dal server nel primo HTML inviato al browser.
            Appare IMMEDIATAMENTE, prima che React si carichi.
            L'inline script lo rimuove dopo DOMContentLoaded + 200ms.
        ──────────────────────────────────────────────────────────────────── */}
        <div id="ri-splash" suppressHydrationWarning>
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
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.35em',
              color: 'rgba(201,168,76,0.7)',
              fontSize: '0.52rem',
              fontWeight: 400,
              margin: '10px 0 0 0',
              textTransform: 'uppercase' as const,
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
            <div id="ri-d1" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C9A84C' }} />
            <div id="ri-d2" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C9A84C' }} />
            <div id="ri-d3" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C9A84C' }} />
          </div>
        </div>

        {/* Script che rimuove lo splash — eseguito subito durante il parsing */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />

        {children}
      </body>
    </html>
  )
}
