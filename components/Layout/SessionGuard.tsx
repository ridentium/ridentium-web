'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * SessionGuard — incluso nei layout dashboard.
 * Se l'utente aveva scelto di NON essere ricordato e ha riaperto
 * il browser (sessionStorage vuoto), lo disconnette automaticamente.
 */
export default function SessionGuard() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const remember = localStorage.getItem('ridentium-remember')
    const active = sessionStorage.getItem('ridentium-active')

    if (remember === 'false' && !active) {
      supabase.auth.signOut().then(() => {
        router.replace('/login')
      })
      return
    }

    sessionStorage.setItem('ridentium-active', '1')
  }, [])

  return null
}
