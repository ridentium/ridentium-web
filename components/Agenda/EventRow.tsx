'use client'

import { useState, useEffect, useRef } from 'react'
import type { AgendaEvent } from '@/types/agenda'
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from '@/types/adempimenti'
import type { CategoriaAdempimento } from '@/types/adempimenti'
import {
  TIPO_CONFIG, PRIORITA_COLOR, FREQ_LABEL,
  STATO_LABEL, STATO_COLOR, scadenzaLabel,
  type Profilo,
} from './agendaConstants'
import {
  Check, Loader2, MoreHorizontal, Pencil, Trash2,
  ExternalLink, User, Clock, AlertTriangle, Tag, RefreshCw,
  ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventRowProps {
  event: AgendaEvent
  userId: string
  isAdmin: boolean
  profili: Profilo[]
  completedIds: Set<string>
  onEdit: (e: AgendaEvent) => void
  onDelete: (e: AgendaEvent) => void
  onStatoChange: (id: string, stato: 'da_fare' | 'in_corso' | 'completato') => void
  onQuickComplete: (e: AgendaEvent) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error') => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventRow({
  event: e, userId, isAdmin, completedIds,
  onEdit, onDelete, onStatoChange, onQuickComplete, onToast,
}: EventRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cyclingStato, setCyclingStato] = useState(false)
  const [completing, setCompleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const cfg = TIPO_CONFIG[e.tipo]
  const Icon = cfg.icon
  const scad = scadenzaLabel(e.data)
  const isOwn = e.assegnato_a_id === userId || !e.assegnato_a_id

  const canEdit = isAdmin || (e.tipo === 'task' && isOwn)
  const canDelete = isAdmin || (e.tipo === 'task' && isOwn)

  // Click-outside per chiudere il menu
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function cycleStato() {
    if (e.tipo !== 'task' || !e.stato || cyclingStato) return
    const cycle: Record<string, 'da_fare' | 'in_corso' | 'completato'> = {
      da_fare: 'in_corso', in_corso: 'completato', completato: 'da_fare',
    }
    const nuovoStato = cycle[e.stato] as 'da_fare' | 'in_corso' | 'completato' | undefined
    if (!nuovoStato) return
    setCyclingStato(true)
    const r = await fetch(`/api/tasks/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: nuovoStato }),
    })
    if (r.ok) {
      onStatoChange(e.id, nuovoStato)
      onToast(`Stato: ${STATO_LABEL[nuovoStato]}`)
    } else {
      onToast('Errore aggiornamento stato', 'error')
    }
    setCyclingStato(false)
  }

  async function quickComplete(ev: React.MouseEvent) {
    ev.stopPropagation()
    if (completing) return
    setCompleting(true)
    await onQuickComplete(e)
    setCompleting(false)
  }

  const isRicorrenteCompletata = e.tipo === 'ricorrente' && e.completata_oggi === true
  const isCompleted = (e.tipo === 'task' && e.stato === 'completato') || completedIds.has(e.id) || isRicorrenteCompletata
  const showFattoBtn = !isCompleted && (e.tipo === 'task' || e.tipo === 'adempimento')

  async function doDelete() {
    setDeleting(true)
    const apiPath = e.tipo === 'task' ? 'tasks' : e.tipo === 'ricorrente' ? 'ricorrenti' : 'adempimenti'
    const r = await fetch(`/api/${apiPath}/${e.id}`, { method: 'DELETE' })
    if (r.ok) {
      onDelete(e)
      onToast('Elemento eliminato')
    } else {
      onToast('Errore durante l\'eliminazione', 'error')
    }
    setDeleting(false)
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 transition-colors ${
      isCompleted
        ? 'bg-green-500/5 border-l-2 border-green-500/30 hover:bg-green-500/8'
        : 'hover:bg-obsidian-light/20'
    }`}>
      {/* Icona stato */}
      {showFattoBtn ? (
        <button
          onClick={quickComplete}
          disabled={completing}
          title="Segna come fatto"
          className="mt-0.5 flex-shrink-0 w-6 h-6 rounded border border-dashed border-stone/30 flex items-center justify-center text-stone/40 hover:border-green-400/60 hover:text-green-400 hover:bg-green-400/8 transition-all disabled:opacity-30 group"
        >
          {completing
            ? <Loader2 size={11} className="animate-spin" />
            : <Check size={11} className="group-hover:scale-110 transition-transform" />
          }
        </button>
      ) : isCompleted ? (
        <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded border border-green-500/40 bg-green-500/15 flex items-center justify-center">
          <Check size={11} className="text-green-400" />
        </div>
      ) : (
        <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${cfg.bg}`}>
          <Icon size={12} className={cfg.color} />
        </div>
      )}

      {/* Content — clicca per modificare */}
      <button
        onClick={() => onEdit(e)}
        className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
        title="Clicca per modificare"
      >
        <div className="flex items-start gap-2 flex-wrap">
          <p className={`text-sm font-medium truncate ${isCompleted ? 'text-green-700/70' : isOwn ? 'text-obsidian' : 'text-obsidian/70'}`}>
            {e.titolo}
          </p>
          {isCompleted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400/80 border border-green-500/20 flex-shrink-0">
              {isRicorrenteCompletata ? '✓ Completata' : '✓ Fatto'}
            </span>
          )}
          {!isCompleted && isOwn && e.tipo !== 'ricorrente' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80 border border-gold/20 flex-shrink-0">mio</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className={`text-[10px] flex items-center gap-1 ${cfg.color}`}>
            <Icon size={9} />{cfg.label}
          </span>
          {e.tipo === 'ricorrente' && e.frequenza && (
            <span className="text-[10px] text-stone flex items-center gap-1">
              <RefreshCw size={9} />{FREQ_LABEL[e.frequenza] ?? e.frequenza}
            </span>
          )}
          {e.tipo === 'adempimento' && e.categoria && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: CATEGORIA_COLOR[e.categoria as CategoriaAdempimento] ?? '#A0907E' }}>
              <Tag size={9} />{CATEGORIA_LABEL[e.categoria as CategoriaAdempimento] ?? e.categoria}
            </span>
          )}
          {e.tipo === 'task' && e.priorita && (
            <span className={`text-[10px] flex items-center gap-1 ${PRIORITA_COLOR[e.priorita]}`}>
              <AlertTriangle size={9} />{e.priorita}
            </span>
          )}
          {e.tipo === 'task' && e.stato && (
            <button
              onClick={ev => { ev.preventDefault(); cycleStato() }}
              disabled={cyclingStato}
              title="Tocca per cambiare stato"
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 ${STATO_COLOR[e.stato] ?? 'text-stone border-stone/30'}`}
            >
              {cyclingStato ? '…' : (STATO_LABEL[e.stato] ?? e.stato)}
            </button>
          )}
          {e.assegnato_a_nome && (
            <span className="text-[10px] text-stone flex items-center gap-1">
              <User size={9} />{e.assegnato_a_nome}
            </span>
          )}
          {scad.text && (
            <span className={`text-[10px] flex items-center gap-1 ${scad.color}`}>
              <Clock size={9} />{scad.text}
            </span>
          )}
        </div>
      </button>

      {/* Actions */}
      <div className="flex items-center flex-shrink-0 ml-1">
        {confirmDel ? (
          <div className="flex items-center gap-1 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
            <span className="text-[10px] text-red-400/80 mr-1">Elimina?</span>
            <button onClick={doDelete} disabled={deleting}
              className="text-[10px] font-medium text-red-400 hover:text-red-300 disabled:opacity-50">
              {deleting ? '…' : 'Sì'}
            </button>
            <span className="text-stone/40 text-[10px]">/</span>
            <button onClick={() => setConfirmDel(false)} className="text-[10px] text-stone hover:text-obsidian">No</button>
          </div>
        ) : (canEdit || canDelete) ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={`p-1.5 rounded transition-colors ${menuOpen ? 'bg-gold/10 text-gold' : 'text-stone/50 hover:text-obsidian hover:bg-obsidian-light/40'}`}
              title="Azioni"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-[100] min-w-[130px] rounded-lg border shadow-2xl overflow-hidden"
                style={{ backgroundColor: '#FDFCFA', borderColor: '#DDD5C8' }}
              >
                {canEdit && (
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(e) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-stone hover:text-gold hover:bg-gold/8 transition-colors text-left"
                  >
                    <Pencil size={11} /> Modifica
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDel(true) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-stone hover:text-red-400 hover:bg-red-400/8 transition-colors text-left"
                  >
                    <Trash2 size={11} /> Elimina
                  </button>
                )}
                <a
                  href={e.href}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-stone/50 hover:text-stone hover:bg-obsidian-light/20 transition-colors border-t border-obsidian-light/30"
                >
                  <ExternalLink size={11} /> Vai alla sezione
                </a>
              </div>
            )}
          </div>
        ) : (
          <ChevronRight size={13} className="text-stone/30" />
        )}
      </div>
    </div>
  )
}
