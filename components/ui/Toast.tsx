'use client'

import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export interface ToastState {
  message: string
  type?: 'success' | 'error'
}

interface Props extends ToastState {
  onDismiss: () => void
}

export default function Toast({ message, type = 'success', onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const isSuccess = type === 'success'

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl"
      style={{
        backgroundColor: '#1A1009',
        borderColor: isSuccess ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)',
        color: isSuccess ? '#4ADE80' : '#F87171',
        minWidth: 220,
        animation: 'slideUp 0.2s ease-out',
      }}
    >
      {isSuccess ? <CheckCircle2 size={15} className="flex-shrink-0" /> : <AlertCircle size={15} className="flex-shrink-0" />}
      <span className="text-sm flex-1">{message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0">
        <X size={13} />
      </button>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
