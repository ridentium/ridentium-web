'use client'

import { useState, useMemo, useEffect } from 'react'
import { RegistroEntry } from '@/types'
import { ClipboardList, X, ChevronDown, Download, Search } from 'lucide-react'

const PAGE_SIZE = 50

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
  const [cerca, setCerca] = useState('')
  const [page, setPage] = useState(1)

  const utenti = useMemo(() => {
    const nomi = Array.from(new Set(entries.map(e => e.user_nome))).sort()
    return nomi
  }, [entries])

  const filtered = useMemo(() => {
    const q = cerca.toLowerCase().trim()
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
      if (q && !e.azione.toLowerCase().includes(q) && !(e.dettaglio ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, filterCat, filterUtente, dataDa, dataA, cerca])

  const counts: Record<string, number> = {}
  entries.forEach(e => { counts[e.categoria] = (counts[e.categoria] ?? 0) + 1 })

  const hasFilters = filterCat !== 'tutte' || filterUtente !== 'tutti' || dataDa || dataA || cerca !== ''

  // Reset paginazione quando cambiano i filtri
  useEffect(() => { setPage(1) }, [filterCat, filterUtente, dataDa, dataA, cerca])

  function exportCSV() {
    const rows = [
      ['Data', 'Ora', 'Utente', 'Categoria', 'Azione', 'Dettaglio'],
      ...filtered.map(e => [
        new Date(e.created_at).toLocaleDateString('it-IT'),
        new Date(e.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        e.user_nome,
        e.categoria,
        e.azione,
        e.dettaglio ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registro_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function resetFilters() {
    setFilterCat('tutte')
    setFilterUtente('tutti')
    setDataDa('')
    setDataA('')
    setCerca('')
  }

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > page * PAGE_SIZE

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

      {/* Filtri utente + date + ricerca */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone/40 pointer-events-none" />
          <input
            type="text"
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="Cerca azione o dettaglio…"
            className="input text-xs py-1.5 pl-7 w-52"
          />
        </div>
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
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-stone/50">
            {filtered.length} {filtered.length === 1 ? 'voce' : 'voci'}
          </span>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1 text-xs text-stone hover:text-cream transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download size={11} /> CSV
          </button>
        </div>
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
        <>
          <div className="card p-0 overflow-hidden">
            {paginated.map(entry => (
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
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs text-stone hover:text-cream transition-colors border border-obsidian-light rounded-lg hover:border-stone"
            >
              <ChevronDown size={13} />
              Mostra altri {Math.min(PAGE_SIZE, filtered.length - page * PAGE_SIZE)} — totale {filtered.length}
            </button>
          )}
        </>
      )}
    </div>
  )
}
