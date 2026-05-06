'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function DashboardRefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [justRefreshed, setJustRefreshed] = useState(false)

  function handleRefresh() {
    if (isPending) return
    startTransition(() => {
      router.refresh()
    })
    setJustRefreshed(true)
    setTimeout(() => setJustRefreshed(false), 1500)
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      title="Aggiorna dashboard"
      className="flex items-center gap-1.5 text-xs text-stone/50 hover:text-stone transition-colors disabled:opacity-40"
    >
      <RefreshCw
        size={11}
        className={isPending ? 'animate-spin' : justRefreshed ? 'text-green-400' : ''}
      />
      <span className="hidden sm:inline">
        {isPending ? 'Aggiorno…' : 'Aggiorna'}
      </span>
    </button>
  )
}
