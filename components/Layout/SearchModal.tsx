'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, X, Package, CheckSquare, BookOpen, Users, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  tipo: 'magazzino' | 'task' | 'sop' | 'staff'
  titolo: string
  sottotitolo?: string
  href: string
  alert?: boolean
}

const TIPO_CONFIG = {
  magazzino: { label: 'Magazzino', icon: Package, color: 'text-gold' },
  task: { label: 'Task', icon: CheckSquare, color: 'text-blue-400' },
  sop: { label: 'Protocolli', icon: BookOpen, color: 'text-purple-400' },
  staff: { label: 'Staff', icon: Users, color: 'text-green-400' },
} as const

interface Props {
  isAdmin: boolean
  open: boolean
  onClose: () => void
}

export default function SearchModal({ isAdmin, open, onClose }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    const term = q.trim()
    const ilike = `%${term}%`

    const [
      { data: mz },
      { data: tk },
      { data: sp },
      { data: st },
    ] = await Promise.all([
      supabase.from('magazzino').select('id, prodotto, categoria, quantita, soglia_minima').or(`prodotto.ilike.${ilike},categoria.ilike.${ilike},azienda.ilike.${ilike}`).limit(5),
      supabase.from('tasks').select('id, titolo, stato, priorita').ilike('titolo', ilike).limit(5),
      supabase.from('sop').select('id, titolo, categoria').or(`titolo.ilike.${ilike},categoria.ilike.${ilike}`).limit(5),
      isAdmin
        ? supabase.from('profili').select('id, nome, cognome, ruolo').or(`nome.ilike.${ilike},cognome.ilike.${ilike}`).limit(5)
        : Promise.resolve({ data: [] }),
    ])

    const mapped: SearchResult[] = [
      ...(mz ?? []).map(r => ({
        id: r.id,
        tipo: 'magazzino' as const,
        titolo: r.prodotto,
        sottotitolo: r.categoria,
        href: isAdmin ? '/admin/magazzino' : '/staff/magazzino',
        alert: r.quantita < r.soglia_minima,
      })),
      ...(tk ?? []).map(r => ({
        id: r.id,
        tipo: 'task' as const,
        titolo: r.titolo,
        sottotitolo: r.stato?.replace('_', ' '),
        href: isAdmin ? '/admin/tasks' : '/staff/tasks',
      })),
      ...(sp ?? []).map(r => ({
        id: r.id,
        tipo: 'sop' as const,
        titolo: r.titolo,
        sottotitolo: r.categoria,
        href: isAdmin ? '/admin/sop' : '/staff/sop',
      })),
      ...((st ?? []) as any[]).map(r => ({
        id: r.id,
        tipo: 'staff' as const,
        titolo: `${r.nome} ${r.cognome}`,
        sottotitolo: r.ruolo,
        href: '/admin/staff',
      })),
    ]

    setResults(mapped)
    setSelectedIdx(0)
    setLoading(false)
  }, [isAdmin, supabase])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      navigate(results[selectedIdx])
    }
  }

  function navigate(r: SearchResult) {
    router.push(r.href)
    onClose()
  }

  if (!open) return null

  // Group results by tipo
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    acc[r.tipo] = acc[r.tipo] ?? []
    acc[r.tipo].push(r)
    return acc
  }, {})

  let flatIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-obsidian border border-obsidian-light rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-obsidian-light">
          <Search size={16} className="text-stone flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cerca in magazzino, task, protocolli…"
            className="flex-1 bg-transparent text-cream placeholder-stone/50 outline-none text-sm"
          />
          {loading && <Loader2 size={14} className="text-stone animate-spin flex-shrink-0" />}
          {!loading && query && (
            <button onClick={() => setQuery('')} className="text-stone/50 hover:text-stone">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-stone/40 border border-obsidian-light rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.trim().length >= 2 && (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {results.length === 0 && !loading && (
              <p className="text-center text-stone text-sm py-8">Nessun risultato per &ldquo;{query}&rdquo;</p>
            )}

            {(Object.keys(TIPO_CONFIG) as (keyof typeof TIPO_CONFIG)[])
              .filter(tipo => grouped[tipo]?.length)
              .map(tipo => {
                const cfg = TIPO_CONFIG[tipo]
                const Icon = cfg.icon
                return (
                  <div key={tipo} className="mb-1">
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <Icon size={11} className={cfg.color} />
                      <span className="text-[10px] uppercase tracking-widest text-stone/60 font-medium">{cfg.label}</span>
                    </div>
                    {grouped[tipo].map(r => {
                      const isSelected = flatIdx === selectedIdx
                      flatIdx++
                      return (
                        <button
                          key={r.id}
                          onClick={() => navigate(r)}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors',
                            isSelected ? 'bg-obsidian-light' : 'hover:bg-obsidian-light/50'
                          )}
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-cream truncate">{r.titolo}</p>
                            {r.sottotitolo && (
                              <p className="text-xs text-stone mt-0.5 capitalize">{r.sottotitolo}</p>
                            )}
                          </div>
                          {r.alert && (
                            <AlertTriangle size={12} className="text-red-400 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })
            }
          </div>
        )}

        {/* Empty state hint */}
        {query.trim().length < 2 && (
          <div className="px-4 py-6 text-center">
            <p className="text-stone text-xs">
              Digita almeno 2 caratteri per cercare
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-stone/40 text-xs">
              <span className="flex items-center gap-1"><kbd className="font-mono border border-obsidian-light rounded px-1">↑↓</kbd> naviga</span>
              <span className="flex items-center gap-1"><kbd className="font-mono border border-obsidian-light rounded px-1">↵</kbd> apri</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
