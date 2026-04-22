'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[route error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'rgba(224,85,69,0.12)', border: '1px solid rgba(224,85,69,0.35)' }}
        >
          <AlertTriangle size={22} style={{ color: '#E05545' }} />
        </div>
        <h2
          className="mb-2 text-lg font-light tracking-wide"
          style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', color: '#F2EDE4' }}
        >
          Qualcosa non ha funzionato
        </h2>
        <p className="text-sm" style={{ color: 'rgba(210,198,182,0.65)' }}>
          Questa pagina non è riuscita a caricarsi. Puoi riprovare: se il problema persiste,
          aggiorna la finestra.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[10px]" style={{ color: 'rgba(160,144,126,0.45)' }}>
            riferimento · {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 rounded border px-4 py-2 text-xs transition-colors"
          style={{ borderColor: 'rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}
        >
          <RefreshCw size={12} /> Riprova
        </button>
      </div>
    </div>
  )
}
