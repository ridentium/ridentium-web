'use client'

import { useState, useEffect } from 'react'
import { Settings2, X, Eye, EyeOff } from 'lucide-react'

const WIDGETS = [
  { id: 'lina',       label: 'Briefing Lina AI' },
  { id: 'kpi',        label: 'KPI riepilogo' },
  { id: 'scadenze',   label: 'Adempimenti urgenti' },
  { id: 'tasks',      label: 'Task & Ricorrenti' },
  { id: 'riordini',   label: 'Richieste riordino' },
] as const

type WidgetId = typeof WIDGETS[number]['id']

const STORAGE_KEY = 'dashboard_widgets_hidden'

function getHidden(): Set<WidgetId> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveHidden(hidden: Set<WidgetId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)))
}

export default function DashboardPersonalizza() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<Set<WidgetId>>(new Set())

  useEffect(() => {
    const h = getHidden()
    setHidden(h)
    applyHidden(h)
  }, [])

  function applyHidden(h: Set<WidgetId>) {
    WIDGETS.forEach(w => {
      const el = document.getElementById(`widget-${w.id}`)
      if (el) el.style.display = h.has(w.id) ? 'none' : ''
    })
  }

  function toggle(id: WidgetId) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      saveHidden(next)
      applyHidden(next)
      return next
    })
  }

  function resetAll() {
    const empty = new Set<WidgetId>()
    setHidden(empty)
    saveHidden(empty)
    applyHidden(empty)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-stone/50 hover:text-stone transition-colors"
        title="Personalizza dashboard"
      >
        <Settings2 size={11} />
        <span className="hidden sm:inline">Personalizza</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-obsidian/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="card w-full max-w-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-cream">Personalizza dashboard</h3>
              <button onClick={() => setOpen(false)} className="btn-ghost p-1">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {WIDGETS.map(w => {
                const isVisible = !hidden.has(w.id)
                return (
                  <button
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-obsidian-light/20 transition-colors"
                  >
                    <span className={`text-sm ${isVisible ? 'text-cream' : 'text-stone/50'}`}>{w.label}</span>
                    {isVisible
                      ? <Eye size={14} className="text-gold/60" />
                      : <EyeOff size={14} className="text-stone/40" />
                    }
                  </button>
                )
              })}
            </div>

            {hidden.size > 0 && (
              <button onClick={resetAll} className="w-full mt-3 text-xs text-stone hover:text-cream transition-colors py-1.5">
                Ripristina tutto
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
