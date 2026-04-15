'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bot, Send, Loader2, Plus, MessageSquare, Trash2, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Sessione {
  id: string
  titolo: string
  created_at: string
  updated_at: string
}

interface BachecaItem {
  tipo: 'scorta' | 'task' | 'riordine' | 'ricorrente'
  priorita: number
  titolo: string
  dettaglio: string
}

interface Props {
  userName: string
  userRole: string
  userId: string
  storico: Sessione[]
  bacheca?: BachecaItem[]
}

const TIPO_COLOR: Record<string, string> = {
  scorta:     'rgba(192,57,43,0.15)',
  task:       'rgba(201,168,76,0.12)',
  riordine:   'rgba(201,168,76,0.12)',
  ricorrente: 'rgba(255,255,255,0.06)',
}
const TIPO_TEXT: Record<string, string> = {
  scorta:     '#ef4444',
  task:       '#C9A84C',
  riordine:   '#C9A84C',
  ricorrente: 'rgba(255,255,255,0.5)',
}
const TIPO_LABEL: Record<string, string> = {
  scorta:     'Magazzino',
  task:       'Task',
  riordine:   'Riordine',
  ricorrente: 'Ricorrente',
}

export default function AiChatPage({ userName, userRole, userId, storico, bacheca = [] }: Props) {
  const [sessioni, setSessioni] = useState<Sessione[]>(storico)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function newChat() {
    setSessionId(null)
    setMessages([])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function loadSession(sid: string) {
    const { data } = await supabase.from('ai_messaggi')
      .select('ruolo, contenuto')
      .eq('sessione_id', sid)
      .order('created_at', { ascending: true })
    setSessionId(sid)
    setMessages((data ?? []).map((m: any) => ({ role: m.ruolo, content: m.contenuto })))
  }

  async function deleteSession(sid: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('ai_sessioni').delete().eq('id', sid)
    setSessioni(prev => prev.filter(s => s.id !== sid))
    if (sessionId === sid) newChat()
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Errore')
      setMessages(prev => [...prev, { role: 'assistant', content: data.risposta }])
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId)
        // Aggiorna la lista sessioni
        const { data: sess } = await supabase.from('ai_sessioni')
          .select('id, titolo, created_at, updated_at')
          .eq('id', data.sessionId).single()
        if (sess) setSessioni(prev => [sess, ...prev])
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${err.message ?? 'Errore di connessione'}`,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-1 gap-4 overflow-hidden mt-4">

      {/* Sidebar sessioni */}
      <div className="w-60 flex-shrink-0 flex flex-col gap-2 overflow-hidden">
        <button onClick={newChat} className="btn-primary flex items-center gap-2 text-xs w-full justify-center">
          <Plus size={13} /> Nuova chat
        </button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessioni.map(s => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2 group transition-colors ${
                sessionId === s.id
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'text-stone hover:text-cream hover:bg-obsidian-light/30'
              }`}
            >
              <MessageSquare size={12} className="flex-shrink-0" />
              <span className="flex-1 truncate">{s.titolo || 'Chat'}</span>
              <button
                onClick={e => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-stone hover:text-red-400 flex-shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </button>
          ))}
          {sessioni.length === 0 && (
            <p className="text-xs text-stone/50 text-center py-4">Nessuna chat precedente</p>
          )}
        </div>
      </div>

      {/* Area chat principale */}
      <div className="flex-1 flex flex-col overflow-hidden card p-0">

        {/* Messaggi */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {isEmpty && (
            <div className="flex flex-col h-full gap-5 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3 pt-2">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={18} className="text-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#E8DCC8' }}>Ciao {userName.split(' ')[0]}, sono Lina</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Il tuo assistente per il gestionale RIDENTIUM.</p>
                </div>
              </div>

              {/* Bacheca del giorno — ordinata per priorità */}
              {bacheca.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(201,168,76,0.7)' }}>
                    Priorità del giorno
                  </p>
                  <div className="space-y-1.5">
                    {bacheca.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(`Dimmi di più su: ${item.titolo}. ${item.dettaglio}`)}
                        className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all hover:opacity-90"
                        style={{ background: TIPO_COLOR[item.tipo], border: `1px solid ${TIPO_TEXT[item.tipo]}22` }}
                      >
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                              style={{ background: `${TIPO_TEXT[item.tipo]}20`, color: TIPO_TEXT[item.tipo] }}>
                          {TIPO_LABEL[item.tipo]}
                        </span>
                        <span className="flex-1 text-xs font-medium truncate" style={{ color: '#E8DCC8' }}>
                          {item.titolo}
                        </span>
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {item.dettaglio}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bacheca.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>✓ Tutto in ordine oggi — nessuna urgenza!</p>
                </div>
              )}

              {/* Suggerimenti rapidi */}
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Domande rapide
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    'Cosa è sotto soglia nel magazzino?',
                    'Mostrami i task aperti urgenti',
                    'Quanti impianti Neodent ø4 abbiamo?',
                    'Quali riordini sono aperti?',
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-3 py-2 rounded transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#E8DCC8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={13} className="text-gold" />
                </div>
              )}
              <div
                className="max-w-[75%] px-4 py-3 rounded-xl text-sm leading-relaxed"
                style={msg.role === 'user'
                  ? { background: '#C9A84C', color: '#0D0D0B' }
                  : { background: '#1A1714', color: '#E8DCC8', border: '1px solid rgba(255,255,255,0.06)' }
                }
              >
                <FormattedMessage content={msg.content} />
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-gold" />
              </div>
              <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2 text-stone"
                   style={{ background: '#1A1714', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Loader2 size={14} className="animate-spin" />
                Lina sta elaborando…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 pb-5 pt-3 border-t border-obsidian-light/30">
          <div className="flex items-end gap-3 rounded-xl px-4 py-3"
               style={{ background: '#1A1714', border: '1px solid rgba(255,255,255,0.08)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Chiedi a Lina qualcosa sul gestionale…`}
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-cream text-sm resize-none outline-none placeholder-stone/40 max-h-36"
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
              style={{ background: input.trim() && !loading ? '#C9A84C' : '#2A2520' }}
            >
              <Send size={15} className={input.trim() && !loading ? 'text-obsidian' : 'text-stone'} />
            </button>
          </div>
          <p className="text-xs text-stone/30 mt-2 text-center">
            Enter per inviare · Shift+Enter per andare a capo · Modello: Llama 3.3 70B (Groq)
          </p>
        </div>
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*|\n•|\n-|\n)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part === '\n') return <br key={i} />
        if (part === '\n•' || part === '\n-') return <span key={i}><br />•</span>
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
