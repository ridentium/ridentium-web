'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenziali non valide. Verifica email e password.')
      setLoading(false)
      return
    }

    localStorage.setItem('ridentium-remember', rememberMe ? 'true' : 'false')
    sessionStorage.setItem('ridentium-active', '1')

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(160deg, #1A1714 60%, #242018 100%)' }}
    >
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl text-cream tracking-[0.25em] font-light mb-1">
          RIDENTIUM
        </h1>
        <p className="text-stone text-xs tracking-[0.35em] uppercase">
          Sistema Operativo Interno
        </p>
        <div className="mt-4 w-12 h-px bg-gold mx-auto opacity-60" />
      </div>

      <div className="w-full max-w-sm">
        <div className="card border-obsidian-light/60">
          <p className="text-stone text-xs tracking-widest uppercase mb-6">Accesso</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label-field block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="nome@ridentium.it"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label-field block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-0.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  rememberMe
                    ? 'bg-gold border-gold'
                    : 'bg-transparent border-stone/40 hover:border-stone/70'
                }`}
              >
                {rememberMe && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#1A1714" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span
                className="text-stone/70 text-xs cursor-pointer select-none"
                onClick={() => setRememberMe(!rememberMe)}
              >
                Ricorda la mia password
              </span>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Accesso in corso…' : 'Accedi'}
            </button>
          </form>
        </div>

        <p className="text-center text-stone/50 text-xs mt-6">
          Accesso riservato al personale RIDENTIUM
        </p>
      </div>
    </div>
  )
}
