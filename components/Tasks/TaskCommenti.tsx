'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, Trash2, MessageSquare, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TaskCommento } from '@/types'

interface Props {
  taskId: string
  userId: string
  userNome: string
  isAdmin: boolean
}

export default function TaskCommenti({ taskId, userId, userNome, isAdmin }: Props) {
  const [commenti, setCommenti] = useState<TaskCommento[]>([])
  const [loading, setLoading] = useState(true)
  const [testo, setTesto] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tasks/${taskId}/commenti`, { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setCommenti(d.commenti ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    load()

    const supabase = createClient()
    const channel = supabase
      .channel(`task-commenti-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_commenti', filter: `task_id=eq.${taskId}` },
        () => { load() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, load])

  async function handleSend() {
    const testo_ = testo.trim()
    if (!testo_) return
    setSending(true)
    try {
      const r = await fetch(`/api/tasks/${taskId}/commenti`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testo_, utente_nome: userNome }),
      })
      if (r.ok) {
        setTesto('')
        await load()
      }
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(commentoId: string) {
    setDeletingId(commentoId)
    try {
      await fetch(`/api/tasks/${taskId}/commenti?commentoId=${commentoId}`, { method: 'DELETE' })
      setCommenti(prev => prev.filter(c => c.id !== commentoId))
    } finally {
      setDeletingId(null)
    }
  }

  function formatData(iso: string) {
    return new Date(iso).toLocaleString('it-IT', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-obsidian-light/20" />
        <div className="flex items-center gap-1.5">
          <MessageSquare size={11} className="text-stone/40" />
          <span className="text-[10px] uppercase tracking-widest text-stone/50">Commenti</span>
          {commenti.length > 0 && (
            <span className="text-[10px] text-stone/40">({commenti.length})</span>
          )}
        </div>
        <div className="h-px flex-1 bg-obsidian-light/20" />
      </div>

      {/* Lista commenti */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1 -mr-1">
        {loading ? (
          <div className="flex justify-center py-5">
            <Loader2 size={14} className="animate-spin text-stone/40" />
          </div>
        ) : commenti.length === 0 ? (
          <p className="text-[11px] text-stone/40 text-center py-3 italic">
            Nessun commento ancora
          </p>
        ) : (
          commenti.map(c => (
            <div key={c.id} className="flex gap-2 group">
              <div className="flex-1 min-w-0 bg-white/5 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] text-gold/70 font-medium truncate">{c.utente_nome}</span>
                  <span className="text-[9px] text-stone/40 shrink-0">{formatData(c.created_at)}</span>
                </div>
                <p className="text-xs text-cream/80 leading-relaxed whitespace-pre-wrap break-words">{c.testo}</p>
              </div>
              {(c.utente_id === userId || isAdmin) && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-stone/30 hover:text-red-400 flex-shrink-0 self-start mt-1 rounded"
                  title="Elimina commento"
                >
                  {deletingId === c.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Trash2 size={11} />}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="input flex-1 text-xs py-2"
          placeholder="Scrivi un commento… (Invio per inviare)"
          value={testo}
          onChange={e => setTesto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          maxLength={2000}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!testo.trim() || sending}
          className="flex-shrink-0 px-3 py-2 rounded border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors disabled:opacity-40"
          title="Invia commento"
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  )
}
