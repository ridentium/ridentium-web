'use client'

import { useState } from 'react'
import { RegistroEntry } from '@/types'
import { ClipboardList, Download } from 'lucide-react'

const CATEGORIE = ['tutte', 'todo', 'magazzino', 'staff', 'ricorrenti', 'sistema', 'altro'] as const
const CAT_LABEL: Record<string, string> = {
  tutte: 'Tutte',
  todo: 'To-Do',
  magazzino: 'Magazzino',
  staff: 'Staff',
  ricorrenti: 'Ricorrenti',
  sistema: 'Sistema',
  altro: 'Altro',
}
const CAT_COLOR: Record<string, string> = {
  todo: 'text-purple-400 bg-purple-400/10',
  magazzino: 'text-green-400 bg-green-400/10',
  staff: 'text-red-400 bg-red-400/10',
  ricorrenti: 'text-gold bg-gold/10',
  sistema: 'text-blue-400 bg-blue-400/10',
  altro: 'text-stone bg-stone/10',
}
const CAT_ICON: Record<string, string> = {
  todo: '✅',
  magazzino: '📦',
  staff: '👤',
  ricorrenti: '🔄',
  sistema: '⚙️',
  altro: '📋',
}

function toCSV(rows: RegistroEntry[]): string {
  const headers = ['Data', 'Ora', 'Utente', 'Categoria', 'Azione', 'Dettaglio']
  const escape = (v: string) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const lines = rows.map(e => {
    const d = new Date(e.created_at)
    return [
      d.toLocaleDateString('it-IT'),
      d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      e.user_nome,
      e.categoria,
      e.azione,
      e.dettaglio ?? '',
    ].map(escape).join(',')
  })
  return [headers.map(escape).join(','), ...lines].join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function RegistroAdmin({ entries }: { entries: RegistroEntry[] }) {
  const [filterCat, setFilterCat] = useState<string>('tutte')

  const filtered = entries.filter(e => filterCat === 'tutte' || e.categoria === filterCat)

  function handleExport() {
    const today = new Date().toISOString().split('T')[0]
    const cat = filterCat === 'tutte' ? 'completo' : filterCat
    downloadCSV(`registro_${cat}_${today}.csv`, toCSV(filtered))
  }

  return (
    <div className="space-y-5">

      {/* Filtri categoria + Export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {CATEGORIE.map(cat => (
            <button key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      filterCat === cat
                        ? 'bg-gold text-obsidian border-gold'
                        : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                    }`}>
              {cat !== 'tutte' && CAT_ICON[cat] + ' '}{CAT_LABEL[cat]}
              {cat === 'tutte' && ` (${entries.length})`}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-obsidian-light text-stone hover:border-stone hover:text-cream transition-colors flex-shrink-0"
          >
            <Download size={11} /> CSV ({filtered.length})
          </button>
        )}
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
            <div key={entry.id} className="flex items-start gap-4 px-5 py-4 border-b border-obsidian-light/40 last:border-0 hover:bg-obsidian-light/20 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${CAT_COLOR[entry.categoria] || 'text-stone bg-stone/10'}`}>
                {CAT_ICON[entry.categoria] || '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-cream font-medium">{entry.azione}</p>
                {entry.dettaglio && <p className="text-xs text-stone mt-0.5">{entry.dettaglio}</p>}
                <p className="text-xs text-stone/60 mt-1">{entry.user_nome}</p>
              </div>
              <div className="text-xs text-stone flex-shrink-0 text-right">
                <p>{new Date(entry.created_at).toLocaleDateString('it-IT')}</p>
                <p className="text-stone/60">{new Date(entry.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
