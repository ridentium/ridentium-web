'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="it">
      <body style={{ background: '#1A1009', color: '#F2EDE4', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <p
              style={{
                fontFamily: '"Cormorant Garamond",Georgia,serif',
                letterSpacing: '0.45em',
                color: '#EDE0CC',
                fontSize: '1.4rem',
                fontWeight: 300,
                margin: 0,
              }}
            >
              RIDENTIUM
            </p>
            <div style={{ width: 40, height: 1, background: '#C9A84C', opacity: 0.6, margin: '20px auto' }} />
            <h2 style={{ fontWeight: 300, fontSize: '1.1rem', marginBottom: 8, color: '#F2EDE4' }}>
              Errore imprevisto
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(210,198,182,0.65)' }}>
              Ricarica l&apos;applicazione. Se il problema persiste, contatta l&apos;assistenza.
            </p>
            {error?.digest && (
              <p style={{ marginTop: 14, fontFamily: 'monospace', fontSize: 10, color: 'rgba(160,144,126,0.45)' }}>
                riferimento · {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                marginTop: 22,
                padding: '8px 18px',
                fontSize: 12,
                color: '#C9A84C',
                background: 'rgba(201,168,76,0.1)',
                border: '1px solid rgba(201,168,76,0.4)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Ricarica
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
