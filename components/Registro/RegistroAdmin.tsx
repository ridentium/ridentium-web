'use client'

import { useState, useMemo } from 'react'
import { RegistroEntry } from '@/types'
import { ClipboardList, X } from 'lucide-react'

const CATEGORIE = ['tutte', 'magazzino', 'ordini', 'fornitori', 'ricorrenti', 'todo', 'tasks', 'crm', 'staff', 'adempimenti', 'sistema', 'altro'] as const

const CAT_LABEL: Record<string, string> = {
  tutte: 'Tutte', magazzino: 'Magazzino', ordini: 'Ordini', fornitori: 'Fornitori',
  ricorrenti: 'Ricorrenti', todo: 'To-Do', tasks: 'Task', crm: 'CRM',
  staff: 'Staff', adempimenti: 'Adempimenti', sistema: 'Sistema', altro: 'Altro',
}

const CAT_COLOR: Record<string, string> = {
  magazzino: 'text-green-400 bg-green-400/10', ordini: 'text-blue-400 bg-blue-400/10',
  fornitori: 'text-violet-400 bg-violet-400/10', ricorrenti: 'text-gold bg-gold/10',
  todo: 'text-purple-400 bg-purple-400/10', tasks: 'text-blue-400 bg-blue-400/10',
  crm: 'text-pink-400 bg-pink-400/10', staff: 'text-red-400 bg-red-400/10',
  adempimenti: 'text-amber-400 bg-amber-400/10', sistema: 'text-stone bg-stone/10',
  altro: 'text-stone bg-stone/10',
}

const CAT_ICON: Record<string, string> = {
  magazzino: '📦', ordini: '🛒', fornitori: '🏭', ricorrenti: '🔄',
  todo: '✅', tasks: '✅', crm: '👥', staff: '👤',
  adempimenti: '🛡️', sistema: '⚙️', altro: '📋',
}

export default function RegistroAdmin({ entries }: { entries: RegistroEntry[] }) {
  const [filterCat, setFilterCat] = useState<string>('tutte')
  const [filterUtente, setFilterUtente] = useState<string>('tutti')
  const [dataDa, setDataDa] = useState('')
  const [dataA, setDataA] = useState('')

  const utenti = useMemo(() => {
    const nomi = Array.from(new Set(entries.map(e => e.user_nome))).sort()
    return nomi
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterCat !== 'tutte' && e.categoria !== filterCat) return false
      if (filterUtente !== 'tutti' && e.user_nome !== filterUtente) return false
      if (dataDa) {
        const ts = new Date(e.created_at).toISOString().slice(0, 10)
        if (ts < dataDa) return false
      }
      if (dataA) {
        const ts = new Date(e.created_at).toISOString().slice(0, 10)
        if (ts > dataA) return false
      }
      return true
    })
  }, [entries, filterCat, filterUtente, dataDa, dataA])

  const counts: Record<string, number> = {}
  entries.forEach(e => { counts[e.categoria] = (counts[e.categoria] ?? 0) + 1 })

  const hasFilters = filterCat !== 'tutte' || filterUtente !== 'tutti' || dataDa || dataA

  function resetFilters() {
    setFilterCat('tutte')
    setFilterUtente('tutti')
    setDataDa('')
    setDataA('')
  }

  return (
    <div className="space-y-5">

      {/* Filtri categoria */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIE.map(cat => {
          const count = cat === 'tutte' ? entries.length : (counts[cat] ?? 0)
          if (cat !== 'tutte' && count === 0) return null
          return (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                filterCat === cat
                  ? 'bg-gold text-obsidian border-gold'
                  : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
              }`}>
              {cat !== 'tutte' && (CAT_ICON[cat] ?? '📋') + ' '}{CAT_LABEL[cat] ?? cat}
              {' '}({count})
            </button>
          )
        })}
      </div>

      {/* Filtri utente + date */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <select
            value={filterUtente}
            onChange={e => setFilterUtente(e.target.value)}
            className="input text-xs py-1.5 pr-7"
          >
            <option value="tutti">Tutti gli utenti</option>
            {utenti.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dataDa}
            onChange={e => setDataDa(e.target.value)}
            className="input text-xs py-1.5"
            placeholder="Dal"
            title="Data da"
          />
          <span className="text-stone/40 text-xs">→</span>
          <input
            type="date"
            value={dataA}
            onChange={e => setDataA(e.target.value)}
            className="input text-xs py-1.5"
            placeholder="Al"
            title="Data a"
          />
        </div>
        {hasFilters && (
          <button onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-stone hover:text-cream transition-colors">
            <X size={11} /> Reset
          </button>
        )}
        <span className="text-xs text-stone/50 ml-auto">
          {filtered.length} {filtered.length === 1 ? 'voce' : 'voci'}
        </span>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <ClipboardList size={24} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">Nessuna attività con questi filtri</p>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-3 text-xs text-gold hover:text-gold-light transition-colors">
              Rimuovi filtri
            </button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {filtered.map(entry => (
            <div key={entry.id}
              className="flex items-start gap-4 px-5 py-4 border-b border-obsidian-light/40 last:border-0 hover:bg-obsidian-light/20 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${CAT_COLOR[entry.categoria] ?? 'text-stone bg-stone/10'}`}>
                {CAT_ICON[entry.categoria] ?? '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-cream font-medium">{entry.azione}</p>
                {entry.dettaglio && <p className="text-xs text-stone mt-0.5">{entry.dettaglio}</p>}
                <p className="text-xs text-stone/60 mt-1">{entry.user_nome}</p>
              </div>
              <div className="text-xs text-stone flex-shrink-0 text-right">
                <p>{new Date(entry.created_at).toLocaleDateString('it-IT')}</p>
                <p className="text-stone/60">
                  {new Date(entry.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
