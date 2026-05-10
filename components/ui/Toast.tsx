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
        backgroundColor: '#FDFCFA',
        borderColor: isSuccess ? 'rgba(21,128,61,0.3)' : 'rgba(185,28,28,0.3)',
        color: isSuccess ? '#15803D' : '#B91C1C',
        boxShadow: '0 4px 20px rgba(61,43,31,0.12)',
        minWidth: 220,
        animation: 'slideUp 0.2s ease-out',
      }}
    >
      {isSuccess ? <CheckCircle2 size={15} className="flex-shrink-0" /> : <AlertCircle size={15} className="flex-shrink-0" />}
      <span className="text-sm flex-1" style={{ color: '#3D2B1F' }}>{message}</span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 transition-opacity"
        style={{ color: 'rgba(102,86,71,0.4)', opacity: 1 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
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
