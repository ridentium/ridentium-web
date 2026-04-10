'use client'
import { useState } from 'react'
import { ClipboardList, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RegistroEntry {
  id: string
  user_id: string
  user_nome: string
  azione: string
  dettaglio?: string
  categoria: string
  operazione?: string
  entita_tipo?: string
  entita_id?: string
  metadata?: Record<string, unknown>
  created_at: string
}

const CATEGORIE = ['tutte', 'magazzino', 'tasks', 'ordini', 'ricorrenti', 'staff', 'sop', 'sistema', 'altro'] as const

const CAT_LABEL: Record<string, string> = {
  tutte: 'Tutte', magazzino: 'Magazzino', tasks: 'Task', ordini: 'Ordini',
  ricorrenti: 'Ricorrenti', staff: 'Staff', sop: 'SOP', sistema: 'Sistema', altro: 'Altro',
  todo: 'To-Do',
}

const CAT_COLOR: Record<string, string> = {
  todo: 'text-purple-400 bg-purple-400/10',
  tasks: 'text-purple-400 bg-purple-400/10',
  magazzino: 'text-green-400 bg-green-400/10',
  staff: 'text-red-400 bg-red-400/10',
  ricorrenti: 'text-gold bg-gold/10',
  ordini: 'text-blue-400 bg-blue-400/10',
  sop: 'text-amber-400 bg-amber-400/10',
  sistema: 'text-cyan-400 bg-cyan-400/10',
  altro: 'text-stone bg-stone/10',
}

const CAT_ICON: Record<string, string> = {
  todo: '✅', tasks: '✅', magazzino: '📦', staff: '👤',
  ricorrenti: '🔄', sistema: '⚙️', ordini: '🛒', sop: '📖', altro: '📋',
}

const OP_CONFIG: Record<string, { label: string; cls: string }> = {
  insert: { label: 'Creato',    cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  update: { label: 'Aggiornato', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  delete: { label: 'Eliminato', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
  action: { label: 'Azione',    cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
}

function toCSV(rows: RegistroEntry[]): string {
  const headers = ['Data', 'Ora', 'Utente', 'Categoria', 'Operazione', 'Azione', 'Entità', 'ID', 'Dettaglio']
  const escape = (v: string) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const lines = rows.map(e => {
    const d = new Date(e.created_at)
    return [
      d.toLocaleDateString('it-IT'),
      d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      e.user_nome,
      e.categoria,
      e.operazione ?? '',
      e.azione,
      e.entita_tipo ?? '',
      e.entita_id ?? '',
      e.dettaglio ?? '',
    ].map(escape).join(',')
  })
  return [headers.map(escape).join(','), ...lines].join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> }) {
  const keys = Object.keys(metadata)
  const prima = metadata.prima as Record<string, unknown> | undefined
  const dopo = metadata.dopo as Record<string, unknown> | undefined

  if (prima && dopo) {
    // Show diff style for before/after
    const allKeys = Array.from(new Set([...Object.keys(prima), ...Object.keys(dopo)]))
    const changed = allKeys.filter(k => JSON.stringify(prima[k]) !== JSON.stringify(dopo[k]))
    if (changed.length === 0) return null
    return (
      <div className="mt-2 rounded border border-obsidian-light bg-obsidian/60 overflow-hidden text-xs">
        <div className="grid grid-cols-3 gap-0 text-[10px] text-stone/50 px-3 py-1.5 border-b border-obsidian-light">
          <span>Campo</span><span>Prima</span><span>Dopo</span>
        </div>
        {changed.map(k => (
          <div key={k} className="grid grid-cols-3 gap-0 px-3 py-1.5 border-b border-obsidian-light/40 last:border-0">
            <span className="text-stone font-mono">{k}</span>
            <span className="text-red-400/80 font-mono truncate">{String(prima[k] ?? '—')}</span>
            <span className="text-green-400/80 font-mono truncate">{String(dopo[k] ?? '—')}</span>
          </div>
        ))}
      </div>
    )
  }

  // Generic metadata display
  return (
    <div className="mt-2 rounded border border-obsidian-light bg-obsidian/60 p-3 text-xs font-mono text-stone/70 overflow-x-auto">
      {keys.map(k => (
        <div key={k}><span className="text-stone">{k}:</span> {JSON.stringify(metadata[k])}</div>
      ))}
    </div>
  )
}

function EntryRow({ entry }: { entry: RegistroEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0
  const op = entry.operazione ? OP_CONFIG[entry.operazione] : null
  const cat = entry.categoria

  return (
    <div className="border-b border-obsidian-light/40 last:border-0">
      <div
        className={cn(
          'flex items-start gap-3 px-4 py-3 hover:bg-obsidian-light/20 transition-colors',
          hasMetadata && 'cursor-pointer'
        )}
        onClick={() => hasMetadata && setExpanded(e => !e)}
      >
        {/* Category icon */}
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5',
          CAT_COLOR[cat] || 'text-stone bg-stone/10')}>
          {CAT_ICON[cat] || '📋'}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-cream font-medium">{entry.azione}</p>
            {op && (
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider', op.cls)}>
                {op.label}
              </span>
            )}
            {entry.entita_tipo && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-obsidian-light text-stone/60 border border-obsidian-light">
                {entry.entita_tipo}
              </span>
            )}
          </div>
          {entry.dettaglio && <p className="text-xs text-stone mt-0.5 truncate">{entry.dettaglio}</p>}
          <p className="text-[10px] text-stone/50 mt-1">{entry.user_nome}</p>

          {/* Expanded metadata */}
          {expanded && entry.metadata && <MetadataPanel metadata={entry.metadata} />}
        </div>

        {/* Right side: timestamp + expand indicator */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-xs text-stone">{new Date(entry.created_at).toLocaleDateString('it-IT')}</p>
          <p className="text-[10px] text-stone/60">{new Date(entry.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
          {hasMetadata && (
            <span className="text-stone/40">
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RegistroAdmin({ entries }: { entries: RegistroEntry[] }) {
  const [filterCat, setFilterCat] = useState<string>('tutte')

  // Normalise 'todo' → 'tasks' for display
  const normalised = entries.map(e => ({ ...e, categoria: e.categoria === 'todo' ? 'tasks' : e.categoria }))
  const filtered = normalised.filter(e => filterCat === 'tutte' || e.categoria === filterCat)

  function handleExport() {
    const today = new Date().toISOString().split('T')[0]
    const cat = filterCat === 'tutte' ? 'completo' : filterCat
    downloadCSV(`registro_${cat}_${today}.csv`, toCSV(filtered))
  }

  // Count per category
  const counts = normalised.reduce<Record<string, number>>((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Filtri + Export */}
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {CATEGORIE.map(cat => {
            const count = cat === 'tutte' ? entries.length : (counts[cat] ?? 0)
            if (cat !== 'tutte' && count === 0) return null
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded border transition-colors',
                  filterCat === cat
                    ? 'bg-gold text-obsidian border-gold'
                    : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                )}
              >
                {cat !== 'tutte' && CAT_ICON[cat] + ' '}{CAT_LABEL[cat] ?? cat}
                <span className="ml-1 opacity-60">({count})</span>
              </button>
            )
          })}
        </div>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-obsidian-light text-stone hover:border-stone hover:text-cream transition-colors flex-shrink-0"
          >
            <Download size={11} />
            CSV ({filtered.length})
          </button>
        )}
      </div>

      {/* Legend for operazione */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(OP_CONFIG).map(([k, v]) => (
          <span key={k} className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider', v.cls)}>
            {v.label}
          </span>
        ))}
        <span className="text-[10px] text-stone/40">— clicca una riga per vedere i dettagli</span>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <ClipboardList size={24} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">Nessuna attività registrata</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {filtered.map(entry => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
