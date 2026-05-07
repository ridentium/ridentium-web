/**
 * useUserPref — hook per preferenze utente persistenti in DB
 *
 * - localStorage come fast-path cache (risposta istantanea)
 * - DB come source of truth (cross-device sync)
 * - Scritture fire-and-forget (non bloccano la UI)
 *
 * Utilizzo:
 *   const [view, setView] = useUserPref<'kanban'|'list'>('tasks_view', 'kanban')
 */

'use client'

import { useState, useEffect, useRef } from 'react'

// Deduplicazione fetch: tutte le istanze del hook sulla stessa pagina
// condividono una singola Promise al volo.
let _promise: Promise<Record<string, unknown>> | null = null
let _cache: Record<string, unknown> | null = null

async function loadPrefs(): Promise<Record<string, unknown>> {
  if (_cache !== null) return _cache
  if (!_promise) {
    _promise = fetch('/api/profilo/prefs')
      .then(r => r.ok ? r.json() : { prefs: {} })
      .then(({ prefs }) => { _cache = prefs ?? {}; return _cache! })
      .catch(() => { _promise = null; return {} })
  }
  return _promise
}

async function saveRemote(key: string, value: unknown) {
  try {
    await fetch('/api/profilo/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (_cache) _cache[key] = value
  } catch {
    // fire-and-forget: silently ignore errors
  }
}

const LS_PREFIX = 'up:'

export function useUserPref<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    // Legge localStorage immediatamente (nessun hydration mismatch)
    if (typeof window === 'undefined') return defaultValue
    try {
      const raw = localStorage.getItem(LS_PREFIX + key)
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue
    } catch { return defaultValue }
  })

  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true

    // Carica da DB in background e aggiorna se diverso da localStorage
    loadPrefs().then(prefs => {
      if (key in prefs) {
        const remote = prefs[key] as T
        setValue(remote)
        try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(remote)) } catch {}
      }
    })
  }, [key])

  function set(newValue: T) {
    setValue(newValue)
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(newValue)) } catch {}
    saveRemote(key, newValue)
  }

  return [value, set]
}

/** Invalida la cache in-memory (utile dopo logout) */
export function invalidatePrefsCache() {
  _promise = null
  _cache = null
}
